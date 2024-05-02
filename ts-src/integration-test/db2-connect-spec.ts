import { connect } from '..'
import { expect } from 'chai'

describe('connect', () => {
  it('should connect', async () => {
    const db = await connect()
    const nUpdated = await db.update('delete from tsttbl')
    expect(nUpdated).to.be.least(0)
  }).timeout(10000)

  it('should close', async () => {
    const db = await connect()
    await db.close()

    return db
      .update('delete from tsttbl')
      .then(() => {
        throw new Error('should not be connected')
      })
      .catch((err) => {
        expect(err.message).to.equal('The connection does not exist.')
        expect(err.category).to.equal('OperationalError')
      })
  }).timeout(6000)
})
