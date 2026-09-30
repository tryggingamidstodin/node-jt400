import assert from 'assert'
import { describe, it } from 'node:test'
import { jt400 } from './db.js'

describe('keyed dataQ', () => {
  it('should read and write', { timeout: 5000 }, (_t, done) => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })

    dataQ
      .read('mytestkey')
      .then((data) => {
        assert.strictEqual(data, 'ping')
      })
      .then(done, done)

    dataQ.write('mytestkey', 'ping')
  })

  it('should fail on timeout', (_t, done) => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })
    dataQ
      .read({ key: 'mytestkey', wait: 1 /* sec */ })
      .catch((err) => {
        assert.ok(err.message.includes('timeout, key: mytestkey'))
      })
      .then(done, done)
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
