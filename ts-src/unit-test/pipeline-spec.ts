import { describe, it } from 'node:test'
import assert from 'assert'
import { once } from 'events'
import { pipeline } from 'stream'
import { JdbcStream } from '../lib/jdbcstream.js'
import { parseJsonArray } from '../lib/parseJsonArray.js'
import { arrayToObject } from '../lib/streamTransformers.js'

function closeEvent(s: NodeJS.EventEmitter) {
  return new Promise<void>((resolve) => s.once('close', () => resolve()))
}

function fakeJavaStream(chunks: (string | null)[]) {
  let closed = 0
  const queue = [...chunks]
  return {
    stream: {
      read: async () => (queue.length ? queue.shift()! : null),
      close: async () => {
        closed++
      },
    },
    closedCount: () => closed,
  }
}

// same wiring as asObjectStream() in baseConnection.ts
function objectPipeline(fake: ReturnType<typeof fakeJavaStream>) {
  const source = new JdbcStream({ jdbcStream: fake.stream })
  const out = pipeline(
    source,
    parseJsonArray(),
    arrayToObject([{ name: 'ID' }, { name: 'NAME' }]),
    () => undefined,
  )
  return { source, out }
}

describe('stream pipeline', () => {
  it('delivers every row when fully consumed', async () => {
    const fake = fakeJavaStream(['[[1,"a"],[2,', '"b"],[3,"c"]]', null])
    const { out } = objectPipeline(fake)
    const rows: unknown[] = []
    for await (const row of out) rows.push(row)
    assert.deepStrictEqual(rows, [
      { ID: 1, NAME: 'a' },
      { ID: 2, NAME: 'b' },
      { ID: 3, NAME: 'c' },
    ])
    assert.ok(fake.closedCount() >= 1)
  })

  it('releases the java stream when the consumer destroys early', async () => {
    const fake = fakeJavaStream(['[[1,"a"],[2,"b"]]', '[[3,"c"]]', '[[4,"d"]]'])
    const { source, out } = objectPipeline(fake)
    const sourceClosed = closeEvent(source)
    out.once('data', () => out.destroy())
    await sourceClosed
    assert.ok(source.destroyed)
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('surfaces a parse error and releases the java stream', async () => {
    const fake = fakeJavaStream(['[[1,"a"],{bad json}]', '[[2,"b"]]'])
    const { source, out } = objectPipeline(fake)
    const sourceClosed = closeEvent(source)
    const [err] = await once(out, 'error')
    assert.ok(err instanceof Error)
    await sourceClosed
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('surfaces an invalid row shape and releases the java stream', async () => {
    const fake = fakeJavaStream(['[[1]]'])
    const { source, out } = objectPipeline(fake)
    const sourceClosed = closeEvent(source)
    const [err] = await once(out, 'error')
    assert.match(err.message, /does not match columns length/)
    await sourceClosed
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('does not drop rows that precede a malformed element', async () => {
    const fake = fakeJavaStream(['[[1,"a"],[2,"b"],{bad}]'])
    const { out } = objectPipeline(fake)
    const rows: unknown[] = []
    out.on('data', (r) => rows.push(r))
    await once(out, 'error')
    // rows parsed before the bad element are delivered, not silently dropped
    assert.deepStrictEqual(rows, [
      { ID: 1, NAME: 'a' },
      { ID: 2, NAME: 'b' },
    ])
  })
})
