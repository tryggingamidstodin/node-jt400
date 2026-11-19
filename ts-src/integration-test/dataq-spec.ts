import assert from 'assert'
import { after, before, beforeEach, describe, it } from 'node:test'
import { connect, type DataQ } from '../index.js'
import { jt400 } from './db.js'

describe('keyed dataQ', () => {
  it('should read and write', { timeout: 5000 }, async () => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })

    const result = dataQ.read('mytestkey')
    dataQ.write('mytestkey', 'ping')

    assert.strictEqual(await result, 'ping')
  })

  it('should fail on timeout', async () => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })
    await assert.rejects(
      dataQ.read({ key: 'mytestkey', wait: 1 /* sec */ }),
      (err: Error) => err.message.includes('timeout, key: mytestkey'),
    )
  })

  it('should write to reponse', () => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })
    dataQ
      .read({ key: 'mytestkey', wait: 1, writeKeyLength: 11 })
      .then((res) => {
        assert.strictEqual(res.data, 'ping')
        res.write('pong')
      })
      .catch((err) => {
        console.log('error reading data Q', err)
      })

    dataQ.write('mytestkey', 'returnkey  ping')

    return dataQ.read({ key: 'returnkey  ', wait: 10 }).then((data) => {
      assert.strictEqual(data, 'pong')
    })
  })
})

// Creates its own plain (non-keyed) data queue in the current library of the
// connection's library list and deletes it afterwards.
describe('dataQ', () => {
  const queueName = `NJT${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`
  let library = ''
  let created = false
  let dataQ: DataQ

  const runCommand = (command: string) =>
    jt400.execute(`CALL QSYS2.QCMDEXC('${command}')`)

  before(async () => {
    const rows = await jt400.query<{ LIB: string }>(
      `select schema_name as lib from qsys2.library_list_info
       where type = 'CURRENT'`,
    )
    assert.ok(rows.length > 0, 'the library list needs a current library')
    library = rows[0].LIB
    await runCommand(`CRTDTAQ DTAQ(${library}/${queueName}) MAXLEN(100)`)
    created = true
    dataQ = jt400.createDataQ({
      path: `/QSYS.LIB/${library}.LIB/${queueName}.DTAQ`,
    })
  })

  after(async () => {
    if (created) {
      await runCommand(`DLTDTAQ DTAQ(${library}/${queueName})`)
    }
  })

  beforeEach(async () => {
    while ((await dataQ.read({ wait: 0 })) !== null) {
      // empty the queue
    }
  })

  it('should resolve with null when the queue is empty', async () => {
    assert.strictEqual(await dataQ.peek(), null)
    assert.strictEqual(await dataQ.read(), null)
    assert.strictEqual(await dataQ.read({ wait: 1 /* sec */ }), null)
  })

  it('should write, peek and read', async () => {
    await dataQ.write('ping')

    assert.strictEqual(await dataQ.peek(), 'ping')
    assert.strictEqual(await dataQ.read(), 'ping')
    assert.strictEqual(await dataQ.peek(), null)
  })

  it('should find the data queue by name in the library list', async () => {
    const byName = jt400.createDataQ({ name: queueName })
    await byName.write('ping')

    assert.strictEqual(await dataQ.peek(), 'ping')
    assert.strictEqual(await byName.read(), 'ping')
  })

  it('should read and write using a direct connection', async () => {
    const db = await connect()
    try {
      const directQueue = db.createDataQ({
        path: `/QSYS.LIB/${library}.LIB/${queueName}.DTAQ`,
      })
      await directQueue.write('direct')
      assert.strictEqual(await directQueue.peek(), 'direct')
      assert.strictEqual(await directQueue.read(), 'direct')
      assert.strictEqual(await directQueue.read(), null)
      assert.strictEqual(
        (await db.query('select * from sysibm.sysdummy1')).length,
        1,
      )
    } finally {
      db.close()
    }
  })

  it('should wait for an entry', { timeout: 5000 }, async () => {
    const result = dataQ.read({ wait: 4 })
    // Make sure the read is waiting on an empty queue before writing.
    await new Promise((resolve) => setTimeout(resolve, 500))
    await dataQ.write('ping')

    assert.strictEqual(await result, 'ping')
  })
})

describe('dataQ that does not exist', () => {
  it('should fail', async () => {
    const missing = jt400.createDataQ({
      path: '/QSYS.LIB/QTEMP.LIB/NOSUCHDTAQ.DTAQ',
    })
    await assert.rejects(missing.peek(), /does not exist/)
  })
})
