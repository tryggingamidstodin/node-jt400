import { describe, it } from 'node:test'
import assert from 'assert'
import { Writable } from 'stream'
import { once } from 'events'
import { createJdbcWriteStream } from '../lib/jdbcwritestream.js'
import { IfsWriteStream } from '../lib/ifs/write_stream.js'

function fakeBatchUpdate(opts: { failOn?: number } = {}) {
  const calls: any[][] = []
  const fn = async (_sql: string, batch: any[]) => {
    calls.push(batch)
    if (opts.failOn !== undefined && calls.length === opts.failOn) {
      throw new Error('batch failed')
    }
    return batch.map(() => 1)
  }
  return { fn, calls }
}

describe('createJdbcWriteStream', () => {
  it('finishes without calling batchUpdate when nothing was written', async () => {
    const { fn, calls } = fakeBatchUpdate()
    const ws = createJdbcWriteStream(fn, 'sql', 10)
    ws.end()
    await once(ws, 'finish')
    assert.strictEqual(calls.length, 0)
  })

  it('flushes a final partial batch on end', async () => {
    const { fn, calls } = fakeBatchUpdate()
    const ws = createJdbcWriteStream(fn, 'sql', 10)
    for (let i = 0; i < 25; i++) ws.write([i])
    ws.end()
    await once(ws, 'finish')
    assert.deepStrictEqual(
      calls.map((c) => c.length),
      [10, 10, 5],
    )
  })

  it('does not send an empty trailing batch when count is a multiple of bufferSize', async () => {
    const { fn, calls } = fakeBatchUpdate()
    const ws = createJdbcWriteStream(fn, 'sql', 5)
    for (let i = 0; i < 10; i++) ws.write([i])
    ws.end()
    await once(ws, 'finish')
    assert.deepStrictEqual(
      calls.map((c) => c.length),
      [5, 5],
    )
  })

  it('defaults bufferSize to 100', async () => {
    const { fn, calls } = fakeBatchUpdate()
    const ws = createJdbcWriteStream(fn, 'sql', undefined)
    for (let i = 0; i < 101; i++) ws.write([i])
    ws.end()
    await once(ws, 'finish')
    assert.deepStrictEqual(
      calls.map((c) => c.length),
      [100, 1],
    )
  })

  it('emits an error when the final flush fails and does not finish', async () => {
    const { fn } = fakeBatchUpdate({ failOn: 1 })
    const ws = createJdbcWriteStream(fn, 'sql', 10)
    let finished = false
    ws.on('finish', () => (finished = true))
    ws.write([1])
    ws.end()
    const [err] = await once(ws, 'error')
    assert.strictEqual(err.message, 'batch failed')
    assert.strictEqual(finished, false)
  })

  it('emits an error when a mid-stream batch fails', async () => {
    const { fn } = fakeBatchUpdate({ failOn: 1 })
    const ws = createJdbcWriteStream(fn, 'sql', 2)
    ws.write([1])
    ws.write([2])
    const [err] = await once(ws, 'error')
    assert.strictEqual(err.message, 'batch failed')
  })
})

function fakeIfsStream(opts: { flushError?: Error; writeError?: Error } = {}) {
  const written: any[] = []
  let flushed = 0
  const stream = {
    write: async (data: any) => {
      if (opts.writeError) throw opts.writeError
      written.push(data)
    },
    flush: async () => {
      flushed++
      if (opts.flushError) throw opts.flushError
    },
  }
  return { stream, written, flushedCount: () => flushed }
}

function createIfsWs(fake: ReturnType<typeof fakeIfsStream>): Writable {
  return new (IfsWriteStream as any)({
    ifsWriteStream: Promise.resolve(fake.stream),
    bufferToJavaType: (b: Buffer) => b.toString(),
  })
}

describe('IfsWriteStream', () => {
  it('writes chunks and flushes once on end', async () => {
    const fake = fakeIfsStream()
    const ws = createIfsWs(fake)
    ws.write(Buffer.from('foo'))
    ws.write(Buffer.from('bar'))
    ws.end()
    await once(ws, 'finish')
    assert.deepStrictEqual(fake.written, ['foo', 'bar'])
    assert.strictEqual(fake.flushedCount(), 1)
  })

  it('flushes on end even when nothing was written', async () => {
    const fake = fakeIfsStream()
    const ws = createIfsWs(fake)
    ws.end()
    await once(ws, 'finish')
    assert.deepStrictEqual(fake.written, [])
    assert.strictEqual(fake.flushedCount(), 1)
  })

  it('emits an error when flush fails', async () => {
    const fake = fakeIfsStream({ flushError: new Error('flush failed') })
    const ws = createIfsWs(fake)
    ws.end()
    const [err] = await once(ws, 'error')
    assert.strictEqual(err.message, 'flush failed')
  })

  it('emits an error when write fails', async () => {
    const fake = fakeIfsStream({ writeError: new Error('write failed') })
    const ws = createIfsWs(fake)
    ws.write(Buffer.from('x'))
    const [err] = await once(ws, 'error')
    assert.strictEqual(err.message, 'write failed')
  })
})
