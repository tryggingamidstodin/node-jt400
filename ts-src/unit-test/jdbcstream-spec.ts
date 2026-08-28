import assert from 'assert'
import { JdbcStream } from '../lib/jdbcstream.js'
import { Logger } from '../lib/logger.js'

/**
 * Stand-in for the Java ResultStream. It records how often close() was
 * called, which is what the connection-lifecycle assertions below are
 * really about: the Java close() returns the connection to the pool, so
 * closing twice hands the same connection out twice, and never closing
 * leaks it.
 */
function fakeJdbcStream(chunks: string[], closeError?: Error) {
  let index = 0
  return {
    closeCount: 0,
    readCount: 0,
    read() {
      this.readCount++
      if (index < chunks.length) {
        return Promise.resolve(chunks[index++])
      }
      // End of data. The real Java stream closes itself here.
      this.closeCount++
      return Promise.resolve(null)
    },
    close() {
      this.closeCount++
      return closeError ? Promise.reject(closeError) : Promise.resolve()
    },
  }
}

function collectingLogger(): Logger & { errors: any[] } {
  const errors: any[] = []
  return {
    errors,
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (...args: any[]) => {
      errors.push(args)
    },
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('JdbcStream', () => {
  it('should read every chunk and end', (done) => {
    const jdbcStream = fakeJdbcStream(['[[1]]', '[[2]]'])
    const stream = new JdbcStream({ jdbcStream }) as any
    const received: string[] = []

    stream.on('data', (chunk) => received.push(chunk.toString()))
    stream.on('end', () => {
      assert.deepStrictEqual(received, ['[[1]]', '[[2]]'])
      done()
    })
  })

  it('should not close the java stream again after it ended by itself', async () => {
    const jdbcStream = fakeJdbcStream(['[[1]]'])
    const stream = new JdbcStream({ jdbcStream }) as any

    await new Promise((resolve) => {
      stream.on('data', () => {})
      stream.on('end', resolve)
    })
    await tick()

    // Exactly one close: the one the Java stream performs at end of data.
    // A second one would return the same connection to the pool twice.
    assert.strictEqual(jdbcStream.closeCount, 1)
  })

  it('should close the java stream when a consumer destroys it early', async () => {
    const jdbcStream = fakeJdbcStream(['[[1]]', '[[2]]', '[[3]]'])
    const stream = new JdbcStream({ jdbcStream }) as any

    await new Promise((resolve) => stream.once('data', resolve))
    assert.strictEqual(jdbcStream.closeCount, 0)

    stream.destroy()
    await tick()

    assert.strictEqual(jdbcStream.closeCount, 1)
  })

  it('should close the java stream when destroyed with an error', async () => {
    const jdbcStream = fakeJdbcStream(['[[1]]', '[[2]]'])
    const stream = new JdbcStream({ jdbcStream }) as any
    const failure = new Error('downstream blew up')
    let emitted: Error | undefined

    stream.on('error', (err) => {
      emitted = err
    })
    await new Promise((resolve) => stream.once('data', resolve))
    stream.destroy(failure)
    await tick()

    assert.strictEqual(jdbcStream.closeCount, 1)
    assert.strictEqual(emitted, failure)
  })

  it('should close the java stream when destroyed before the promise resolved', async () => {
    const jdbcStream = fakeJdbcStream(['[[1]]'])
    const stream = new JdbcStream({
      jdbcStreamPromise: Promise.resolve(jdbcStream),
    }) as any

    stream.destroy()
    await tick()

    assert.strictEqual(jdbcStream.closeCount, 1)
    assert.strictEqual(jdbcStream.readCount, 0)
  })

  it('should log rather than emit an error when close fails', async () => {
    const jdbcStream = fakeJdbcStream(['[[1]]'], new Error('close failed'))
    const logger = collectingLogger()
    const stream = new JdbcStream({ jdbcStream, logger }) as any
    let emitted: Error | undefined

    // No 'error' listener beyond this assertion helper: emitting here is
    // exactly what used to crash consumers that had already received all
    // of their rows.
    stream.on('error', (err) => {
      emitted = err
    })
    await new Promise((resolve) => stream.once('data', resolve))
    stream.destroy()
    await tick()

    assert.strictEqual(emitted, undefined)
    assert.strictEqual(logger.errors.length, 1)
    assert.strictEqual(
      logger.errors[0][1],
      'IBMI DB result stream close failed',
    )
  })

  it('should not leave an unhandled rejection when the stream is never read', async () => {
    const unhandled: any[] = []
    const onUnhandled = (reason) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      // Created and then abandoned, which is what happens when the caller
      // never consumes the stream returned by createReadStream.
      const abandoned = new JdbcStream({
        jdbcStreamPromise: Promise.reject(new Error('connection refused')),
      })
      assert.ok(abandoned)
      await tick()
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }

    assert.deepStrictEqual(unhandled, [])
  })

  it('should still emit the rejection to a reading consumer', (done) => {
    const failure = new Error('connection refused')
    const stream = new JdbcStream({
      jdbcStreamPromise: Promise.reject(failure),
    }) as any

    stream.on('error', (err) => {
      assert.strictEqual(err, failure)
      done()
    })
    stream.resume()
  })
})
