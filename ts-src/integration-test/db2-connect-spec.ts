import assert from 'assert'
import { describe, it } from 'node:test'
import { connect } from '../index.js'

describe('connect', () => {
  it('should connect', { timeout: 10000 }, async () => {
    const db = await connect()
    const nUpdated = await db.update('delete from tsttbl')
    assert.ok(nUpdated >= 0)
  })

  it('should close', { timeout: 6000 }, async () => {
    const db = await connect()
    db.close()

    return db
      .update('delete from tsttbl')
      .then(() => {
        throw new Error('should not be connected')
      })
      .catch((err) => {
        assert.strictEqual(err.message, 'The connection does not exist.')
        assert.strictEqual(err.category, 'OperationalError')
      })
  })
})
