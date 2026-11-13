import assert from 'assert'
import { describe, it } from 'node:test'
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
