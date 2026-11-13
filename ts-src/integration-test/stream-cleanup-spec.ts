import { describe, it } from 'node:test'
import assert from 'assert'
import { once } from 'events'
import { buffer } from 'stream/consumers'
import { connect } from '../index.js'
import { jt400 } from './db.js'

const { ifs } = jt400

// Each iteration opens a connection to the IBM i, and `npm run integration-test`
// applies --test-timeout=10000 to the whole file, so keep the default small.
const ITERATIONS = Number(process.env.CLEANUP_ITERATIONS || 10)

function closed(stream: NodeJS.EventEmitter) {
  return new Promise<void>((resolve) => stream.once('close', () => resolve()))
}

describe('stream cleanup', () => {
  describe('sql streams', () => {
    it(
      'releases the connection when a read stream is destroyed early',
      { timeout: 60000 },
      async () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const stream = jt400.createReadStream('select * from qsys2.systables')
          const done = closed(stream)
          await once(stream, 'data')
          stream.destroy()
          await done
        }
        const res = await jt400.query('select * from sysibm.sysdummy1')
        assert.strictEqual(res.length, 1)
      },
    )
  })

  describe('getTablesAsStream', () => {
    it(
      'does not kill a shared connection() when the stream is consumed',
      { timeout: 30000 },
      async () => {
        const db = await connect()
        try {
          // getTablesAsStream returns a JSONStream (classic stream), so it is
          // consumed with events rather than for-await.
          const tables = await new Promise<unknown[]>((resolve, reject) => {
            const result: unknown[] = []
            db.getTablesAsStream({ schema: 'QSYS2', table: 'SYSTABLE%' })
              .on('data', (t: unknown) => result.push(t))
              .on('end', () => resolve(result))
              .on('error', reject)
          })
          assert.ok(tables.length > 0)
          // Before the fix the stream closed the single shared connection.
          const res = await db.query('select * from sysibm.sysdummy1')
          assert.strictEqual(res.length, 1)
        } finally {
          db.close()
        }
      },
    )
  })

  describe('ifs streams', () => {
    const bigFile = '/atm/test2/stream_cleanup_big.txt'

    it('prepares a file larger than the read buffer', async () => {
      const ws = ifs().createWriteStream(bigFile, { append: false })
      ws.end(Buffer.alloc(200000, 'a'))
      await once(ws, 'finish')
      const meta = await ifs().fileMetadata(bigFile)
      assert.deepStrictEqual(meta, { exists: true, length: 200000 })
    })

    it(
      'releases the connection when a read stream is destroyed early',
      { timeout: 60000 },
      async () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const rs = ifs().createReadStream(bigFile)
          const done = closed(rs)
          await once(rs, 'data')
          rs.destroy()
          await done
        }
        // everything still works afterwards, and reads are complete
        const data = await buffer(ifs().createReadStream(bigFile))
        assert.strictEqual(data.length, 200000)
      },
    )

    it(
      'releases the connection when a write stream is destroyed early',
      { timeout: 60000 },
      async () => {
        const path = '/atm/test2/stream_cleanup_write.txt'
        for (let i = 0; i < ITERATIONS; i++) {
          const ws = ifs().createWriteStream(path, { append: false })
          const done = closed(ws)
          ws.write(Buffer.from('partial'))
          ws.destroy()
          await done
        }
        const ws = ifs().createWriteStream(path, { append: false })
        ws.end(Buffer.from('complete'))
        await once(ws, 'finish')
        const data = await buffer(ifs().createReadStream(path))
        assert.strictEqual(data.toString(), 'complete')
      },
    )

    it(
      'emits an error (instead of stalling) when reading a missing file',
      { timeout: 10000 },
      async () => {
        const rs = ifs().createReadStream('/atm/test/___does_not_exist___.txt')
        rs.resume()
        const [err] = await once(rs, 'error')
        assert.ok(err)
      },
    )

    it('should still read the original test file', async () => {
      const data = await buffer(
        ifs().createReadStream('/atm/test/hello_world.txt'),
      )
      assert.strictEqual(data.toString(), 'Halló heimur!\n')
    })
  })
})
