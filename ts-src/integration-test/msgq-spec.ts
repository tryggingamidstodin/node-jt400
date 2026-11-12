import assert from 'assert'
import { beforeEach, describe, it } from 'node:test'
import { jt400 } from './db.js'
describe.skip('MessageQ', function () {
  let msgq
  beforeEach(async () => {
    // Clear queue
    msgq = await jt400.openMessageQ({
      name: process.env.AS400_TEST_MESSAGE_Q || '',
    })

    const readnext = async () => {
      const message = await msgq.read()
      if (message) {
        return readnext()
      }
    }

    await readnext()
  })

  it(
    'should open a message queue and write/read a message.',
    { timeout: 5000 },
    async () => {
      const testMessage = 'Test Message'
      await msgq.sendInformational(testMessage)
      assert.strictEqual(await msgq.read(), testMessage)
    },
  )
})
