import { jt400 } from './db'
import { expect } from 'chai'

describe('keyed dataQ', () => {
  it('should read and write', done => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })

    dataQ
      .read('mytestkey')
      .then(data => {
        expect(data).to.equal('ping')
      })
      .then(done, done)

    dataQ.write('mytestkey', 'ping')
  }).timeout(5000)

  it('should fail on timeout', done => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })
    dataQ
      .read({ key: 'mytestkey', wait: 1 /*sec*/ })
      .catch(err => {
        expect(err.message).to.contain('timeout, key: mytestkey')
      })
      .then(done, done)
  })

  it('should write to reponse', () => {
    const dataQ = jt400.createKeyedDataQ({ name: 'SDQS1' })
    dataQ
      .read({ key: 'mytestkey', wait: 1, writeKeyLength: 11 })
      .then(res => {
        expect(res.data).to.equal('ping')
        res.write('pong')
      })
      .catch(err => {
        console.log('error reading data Q', err)
      })

    dataQ.write('mytestkey', 'returnkey  ping')

    return dataQ.read({ key: 'returnkey  ', wait: 10 }).then(data => {
      expect(data).to.equal('pong')
    })
  })
})
