import { describe, it } from 'node:test'
import assert from 'assert'
import { once } from 'events'
import { JdbcStream } from '../lib/jdbcstream.js'
import { IfsReadStream } from '../lib/ifs/read_stream.js'
import { IfsWriteStream } from '../lib/ifs/write_stream.js'

function closeEvent(s: NodeJS.EventEmitter) {
  return new Promise<void>((resolve) => s.once('close', () => resolve()))
}

function fakeJavaStream(chunks: any[] = [], opts: { readError?: Error } = {}) {
  let closed = 0
  const queue = [...chunks]
  return {
    stream: {
      read: async () => {
        if (opts.readError) throw opts.readError
        return queue.length ? queue.shift() : null
      },
      close: async () => {
        closed++
      },
    },
    closedCount: () => closed,
  }
}

function createJdbcStream(fake: ReturnType<typeof fakeJavaStream>) {
  return new (JdbcStream as any)({
    jdbcStreamPromise: Promise.resolve(fake.stream),
  })
}

describe('JdbcStream cleanup', () => {
  it('close() releases the java stream immediately when nobody reads', async () => {
    const fake = fakeJavaStream(['[1]'])
    const s = new (JdbcStream as any)({ jdbcStream: fake.stream })
    s.close()
    await new Promise((resolve) => setImmediate(resolve))
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('close() ends the stream normally once consumed', async () => {
    const fake = fakeJavaStream(['[1]'])
    const s = new (JdbcStream as any)({ jdbcStream: fake.stream })
    s.close()
    s.resume()
    await once(s, 'end')
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('closes the java stream when destroyed before reading', async () => {
    const fake = fakeJavaStream()
    const s = createJdbcStream(fake)
    s.destroy()
    await once(s, 'close')
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('closes the java stream when destroyed mid-stream', async () => {
    const fake = fakeJavaStream(['[1]', '[2]', '[3]'])
    const s = createJdbcStream(fake)
    s.once('data', () => s.destroy())
    await once(s, 'close')
    assert.ok(fake.closedCount() >= 1)
  })

  it('closes the java stream and emits error when read fails', async () => {
    const fake = fakeJavaStream([], { readError: new Error('read failed') })
    const s = createJdbcStream(fake)
    const closed = closeEvent(s)
    s.resume()
    const [err] = await once(s, 'error')
    assert.strictEqual(err.message, 'read failed')
    await closed
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('closes the java stream when the stream promise resolves after destroy', async () => {
    const fake = fakeJavaStream()
    let resolve!: (v: any) => void
    const promise = new Promise((r) => (resolve = r))
    const s = new (JdbcStream as any)({ jdbcStreamPromise: promise })
    s.destroy()
    resolve(fake.stream)
    await once(s, 'close')
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('does not throw when closing fails during destroy', async () => {
    const fake = fakeJavaStream()
    fake.stream.close = async () => {
      throw new Error('close failed')
    }
    const s = createJdbcStream(fake)
    s.destroy()
    await once(s, 'close')
  })

  it('does not leave an unhandled rejection when a failed stream is never read', async () => {
    let unhandled: unknown
    const onUnhandled = (reason: unknown) => {
      unhandled = reason
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      new (JdbcStream as any)({
        jdbcStreamPromise: Promise.reject(new Error('query failed')),
      })
      await new Promise((resolve) => setTimeout(resolve, 20))
      assert.strictEqual(unhandled, undefined)
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('close() during an in-flight read releases the java stream once', async () => {
    let finishRead: (v: any) => void = () => {}
    let closed = 0
    const javaStream = {
      read: () => new Promise<any>((resolve) => (finishRead = resolve)),
      close: async () => {
        closed++
      },
    }
    const s = new (JdbcStream as any)({ jdbcStream: javaStream })
    s.resume()
    await new Promise((resolve) => setImmediate(resolve))
    s.close()
    // the read is still pending, so the java stream must not be closed yet
    assert.strictEqual(closed, 0)
    finishRead('[1]')
    await once(s, 'end')
    assert.strictEqual(closed, 1)
  })

  it('close() during an in-flight read still releases when nobody reads again', async () => {
    let finishRead: (v: any) => void = () => {}
    let closed = 0
    const javaStream = {
      read: () => new Promise<any>((resolve) => (finishRead = resolve)),
      close: async () => {
        closed++
      },
    }
    // a one byte buffer fills on the first chunk, so no further _read is asked
    const s = new (JdbcStream as any)({ jdbcStream: javaStream })
    s._readableState.highWaterMark = 1
    s.read(0)
    await new Promise((resolve) => setImmediate(resolve))
    s.close()
    finishRead('[1, 2, 3]')
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.strictEqual(closed, 1)
  })

  function recordingLogger() {
    const errors: any[][] = []
    return {
      errors,
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (...args: any[]) => {
          errors.push(args)
        },
      },
    }
  }

  it('logs a close failure during destroy', async () => {
    const fake = fakeJavaStream()
    fake.stream.close = async () => {
      throw new Error('close failed')
    }
    const { errors, logger } = recordingLogger()
    const s = new (JdbcStream as any)({
      jdbcStreamPromise: Promise.resolve(fake.stream),
      logger,
    })
    s.destroy()
    await once(s, 'close')
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0][0].err.message, 'close failed')
  })

  it('logs instead of emitting an error when close() fails', async () => {
    const fake = fakeJavaStream(['[1]'])
    fake.stream.close = async () => {
      throw new Error('close failed')
    }
    const { errors, logger } = recordingLogger()
    const s = new (JdbcStream as any)({ jdbcStream: fake.stream, logger })
    s.on('error', () => assert.fail('must not emit error'))
    s.close()
    s.resume()
    await once(s, 'end')
    assert.strictEqual(errors.length, 1)
  })
})

describe('IfsReadStream cleanup', () => {
  function create(fake: ReturnType<typeof fakeJavaStream>) {
    return new (IfsReadStream as any)({
      ifsReadStream: Promise.resolve(fake.stream),
      javaTypeToBuffer: (b: any) => (b === null ? null : Buffer.from(b)),
    })
  }

  it('closes the java stream when destroyed early', async () => {
    const fake = fakeJavaStream(['a', 'b', 'c'])
    const s = create(fake)
    s.once('data', () => s.destroy())
    await once(s, 'close')
    assert.ok(fake.closedCount() >= 1)
  })

  it('closes the java stream and emits error when read fails', async () => {
    const fake = fakeJavaStream([], { readError: new Error('read failed') })
    const s = create(fake)
    const closed = closeEvent(s)
    s.resume()
    const [err] = await once(s, 'error')
    assert.strictEqual(err.message, 'read failed')
    await closed
    assert.ok(fake.closedCount() >= 1)
  })
})

describe('IfsWriteStream cleanup', () => {
  function create(opts: { writeError?: Error } = {}) {
    const fake = fakeJavaStream()
    const stream = {
      ...fake.stream,
      write: async () => {
        if (opts.writeError) throw opts.writeError
      },
      flush: async () => {},
    }
    const ws = new (IfsWriteStream as any)({
      ifsWriteStream: Promise.resolve(stream),
      bufferToJavaType: (b: Buffer) => b.toString(),
    })
    return { ws, fake }
  }

  it('closes the java stream when destroyed early', async () => {
    const { ws, fake } = create()
    ws.destroy()
    await once(ws, 'close')
    assert.strictEqual(fake.closedCount(), 1)
  })

  it('closes the java stream and errors the stream when write fails', async () => {
    const { ws, fake } = create({ writeError: new Error('write failed') })
    const closed = closeEvent(ws)
    ws.write(Buffer.from('x'))
    const [err] = await once(ws, 'error')
    assert.strictEqual(err.message, 'write failed')
    await closed
    assert.strictEqual(fake.closedCount(), 1)
  })
})
