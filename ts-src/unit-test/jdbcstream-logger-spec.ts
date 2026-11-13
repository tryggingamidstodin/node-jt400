import { describe, it } from 'node:test'
import assert from 'assert'
import { once } from 'events'
import { createBaseConnection } from '../lib/baseConnection.js'
import { createConnection } from '../lib/connection.js'
import { createStandardInsertList } from '../lib/insertList.js'

/**
 * Checks that the connection code hands its logger to the streams it creates.
 * A fake Java stream whose close() fails stands in for the JVM. The failure is
 * reported through the logger, so a logged error proves the logger arrived.
 */
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

function failingCloseStream() {
  const queue = ['[]']
  return {
    read: async () => (queue.length ? queue.shift() : null),
    close: async () => {
      throw new Error('close failed')
    },
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

function assertLogged(errors: any[][]) {
  assert.strictEqual(errors.length, 1)
  assert.strictEqual(errors[0][0].err.message, 'close failed')
}

function fakeStatement() {
  return {
    isQuerySync: () => true,
    getMetaData: async () => '[]',
    asStreamSync: () => failingCloseStream(),
  }
}

function baseConnectionWith(jdbc: any, logger: any) {
  return createBaseConnection(jdbc, createStandardInsertList, logger, false)
}

describe('logger is passed to JdbcStream', () => {
  it('by createReadStream', async () => {
    const { errors, logger } = recordingLogger()
    const con = baseConnectionWith(
      { queryAsStream: async () => failingCloseStream() },
      logger,
    )
    const stream = con.createReadStream('select 1')
    stream.resume()
    await once(stream, 'end')
    await tick()
    assertLogged(errors)
  })

  it('by statement asStream', async () => {
    const { errors, logger } = recordingLogger()
    const con = baseConnectionWith(
      { execute: async () => fakeStatement() },
      logger,
    )
    const statement = await con.execute('select 1')
    const stream = statement.asStream()
    stream.resume()
    await once(stream, 'end')
    await tick()
    assertLogged(errors)
  })

  it('by statement asObjectStream', async () => {
    const { errors, logger } = recordingLogger()
    const con = baseConnectionWith(
      { execute: async () => fakeStatement() },
      logger,
    )
    const statement = await con.execute('select 1')
    const stream = await statement.asObjectStream()
    stream.resume()
    await once(stream, 'end')
    await tick()
    assertLogged(errors)
  })

  it('by getTablesAsStream', async () => {
    const { errors, logger } = recordingLogger()
    const con = createConnection({
      connection: {
        getTablesAsStreamSync: () => failingCloseStream(),
      } as any,
      insertListFun: createStandardInsertList,
      bufferToJavaType: (() => undefined) as any,
      javaTypeToBuffer: (() => undefined) as any,
      inMemory: false,
      logger,
    })
    const stream = con.getTablesAsStream({ schema: 'S' } as any)
    stream.resume()
    await once(stream, 'end')
    await tick()
    assertLogged(errors)
  })
})
