import { describe, it, before, beforeEach } from 'node:test'
import assert from 'assert'
import jvm from 'java'
import { useInMemoryDb } from '../index.js'

/**
 * Exercises the Java classes directly (through node-java) with a
 * ConnectionProvider that counts borrowed/returned connections, to verify
 * that every code path hands connections back.
 */
let borrowed = 0
let returned = 0
let JdbcJsonClient: any
let JT400: any
let provider: any
let sqlClient: any

const outstanding = () => borrowed - returned

before(async () => {
  // initialises the JVM (classpath, options) as a side effect
  const mem = useInMemoryDb()
  await mem.update('drop table leaktbl if exists')
  await mem.update('create table leaktbl (ID INTEGER, NAME VARCHAR(30))')
  await mem.update("insert into leaktbl values (1, 'a')")
  await mem.update("insert into leaktbl values (2, 'b')")

  const DriverManager = jvm.import('java.sql.DriverManager')
  provider = jvm.newProxy('nodejt400.ConnectionProvider', {
    getConnection: () => {
      borrowed++
      return DriverManager.getConnectionSync(
        'jdbc:hsqldb:mem:test',
        'quser',
        '',
      )
    },
    returnConnection: (c: any) => {
      returned++
      c.closeSync()
    },
    close: () => {},
  })
  JdbcJsonClient = jvm.import('nodejt400.JdbcJsonClient')
  JT400 = jvm.import('nodejt400.JT400')
  sqlClient = new JdbcJsonClient(provider)
})

beforeEach(() => {
  borrowed = 0
  returned = 0
})

describe('java connection handling', () => {
  describe('JdbcJsonClient', () => {
    it('queryAsStream returns the connection when the statement fails', async () => {
      await assert.rejects(() =>
        sqlClient.queryAsStream('select * from nonexisting', '[]', 10),
      )
      assert.strictEqual(borrowed, 1)
      assert.strictEqual(outstanding(), 0)
    })

    it('queryAsStream holds the connection until the stream is closed', async () => {
      const stream = await sqlClient.queryAsStream(
        'select * from leaktbl',
        '[]',
        10,
      )
      assert.strictEqual(outstanding(), 1)
      assert.ok(await stream.read())
      await stream.close()
      assert.strictEqual(outstanding(), 0)
    })

    it('ResultStream.close is idempotent', async () => {
      const stream = await sqlClient.queryAsStream(
        'select * from leaktbl',
        '[]',
        10,
      )
      await stream.close()
      await stream.close()
      assert.strictEqual(returned, 1)
    })

    it('ResultStream returns the connection when drained', async () => {
      const stream = await sqlClient.queryAsStream(
        'select * from leaktbl',
        '[]',
        10,
      )
      while ((await stream.read()) !== null) {
        // drain
      }
      assert.strictEqual(outstanding(), 0)
      // reading after close must not blow up or return the connection again
      assert.strictEqual(await stream.read(), null)
      assert.strictEqual(returned, 1)
    })

    it(
      'returns the connection exactly once when read and close race',
      { timeout: 20000 },
      async () => {
        for (let i = 0; i < 100; i++) {
          const stream = await sqlClient.queryAsStream(
            'select * from leaktbl',
            '[]',
            1,
          )
          await Promise.allSettled([
            stream.read(),
            stream.read(),
            stream.close(),
            stream.close(),
          ])
        }
        assert.strictEqual(borrowed, 100)
        assert.strictEqual(returned, 100)
      },
    )

    it(
      'TablesReadStream returns the connection exactly once when read and close race',
      { timeout: 20000 },
      async () => {
        for (let i = 0; i < 100; i++) {
          const stream = await sqlClient.getTablesAsStream(null, null, '%')
          await Promise.allSettled([
            stream.read(),
            stream.read(),
            stream.close(),
            stream.close(),
          ])
        }
        assert.strictEqual(borrowed, 100)
        assert.strictEqual(returned, 100)
      },
    )

    it('getColumns returns the connection', async () => {
      const res = await sqlClient.getColumns(null, null, 'LEAKTBL', '%')
      assert.strictEqual(JSON.parse(res).length, 2)
      assert.strictEqual(outstanding(), 0)
    })

    it('getPrimaryKeys returns the connection', async () => {
      await sqlClient.getPrimaryKeys(null, null, 'LEAKTBL')
      assert.strictEqual(outstanding(), 0)
    })

    it('getTablesAsStream returns the connection (and does not close it directly)', async () => {
      const stream = await sqlClient.getTablesAsStream(null, null, 'LEAKTBL')
      assert.strictEqual(outstanding(), 1)
      let out = ''
      for (;;) {
        const chunk = await stream.read()
        if (chunk === null) break
        out += chunk
      }
      assert.strictEqual(JSON.parse(out).length, 1)
      assert.strictEqual(outstanding(), 0)
      assert.strictEqual(returned, 1)
    })

    it('TablesReadStream.close is idempotent and releases the connection', async () => {
      const stream = await sqlClient.getTablesAsStream(null, null, '%')
      await stream.close()
      await stream.close()
      assert.strictEqual(borrowed, 1)
      assert.strictEqual(returned, 1)
    })
  })

  describe('StatementWrap', () => {
    it('asArray returns the connection exactly once', async () => {
      const st = await sqlClient.execute('select * from leaktbl', '[]')
      await st.asArray()
      await st.close()
      assert.strictEqual(borrowed, 1)
      assert.strictEqual(returned, 1)
    })

    it('close is idempotent', async () => {
      const st = await sqlClient.execute('select * from leaktbl', '[]')
      await st.close()
      await st.close()
      assert.strictEqual(returned, 1)
    })

    it('does not return the connection twice after asStream', async () => {
      const st = await sqlClient.execute('select * from leaktbl', '[]')
      const stream = await st.asStream(10)
      await stream.close()
      await st.close()
      assert.strictEqual(borrowed, 1)
      assert.strictEqual(returned, 1)
    })
  })

  describe('Transaction', () => {
    const Transaction = () => jvm.import('nodejt400.Transaction')

    it('end returns the connection', async () => {
      const t = new (Transaction())(provider)
      assert.strictEqual(outstanding(), 1)
      await t.end()
      assert.strictEqual(outstanding(), 0)
    })

    it('end returns the connection even when setAutoCommit fails', async () => {
      const t = new (Transaction())(provider)
      // closing the underlying connection makes setAutoCommit(true) throw
      t.getConnectionSync().closeSync()
      await assert.rejects(() => t.end())
      assert.strictEqual(outstanding(), 0)
    })

    it('constructor returns the connection when setAutoCommit fails', async () => {
      const DriverManager = jvm.import('java.sql.DriverManager')
      const closed = DriverManager.getConnectionSync(
        'jdbc:hsqldb:mem:test',
        'quser',
        '',
      )
      closed.closeSync()
      const failing = jvm.newProxy('nodejt400.ConnectionProvider', {
        getConnection: () => {
          borrowed++
          return closed
        },
        returnConnection: () => {
          returned++
        },
        close: () => {},
      })
      await assert.rejects(async () => new (Transaction())(failing))
      assert.strictEqual(outstanding(), 0)
    })
  })

  describe('classes that require an AS400 connection', () => {
    // The HSQLDB connection cannot be cast to AS400JDBCConnectionHandle, which
    // makes these calls throw. The connection must still be handed back.
    it('IFS methods return the connection when they throw', async () => {
      const jt400 = new JT400(provider)
      await assert.rejects(() => jt400.listIfsFiles('/tmp'))
      await assert.rejects(() => jt400.moveIfsFile('/a', '/b'))
      await assert.rejects(() => jt400.deleteIfsFile('/a'))
      await assert.rejects(() => jt400.getIfsFileMetadata('/a'))
      assert.strictEqual(borrowed, 4)
      assert.strictEqual(outstanding(), 0)
    })

    it('IFS stream constructors return the connection when they throw', async () => {
      const jt400 = new JT400(provider)
      await assert.rejects(() => jt400.createIfsReadStream('/a'))
      await assert.rejects(() =>
        jt400.createIfsWriteStream('/', 'a', false, null),
      )
      assert.strictEqual(borrowed, 2)
      assert.strictEqual(outstanding(), 0)
    })

    it('MessageFileHandler.read returns the connection when it throws', async () => {
      const jt400 = new JT400(provider)
      const handler = await jt400.openMessageFile('/QSYS.LIB/QCPFMSG.MSGF')
      await assert.rejects(() => handler.read('CPF0001'))
      assert.strictEqual(borrowed, 1)
      assert.strictEqual(outstanding(), 0)
    })
  })
})
