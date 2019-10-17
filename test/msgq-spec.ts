import { jt400 } from './db'
import { expect } from 'chai'
describe('MessageQ', async function() {
  let msgq
  beforeEach(async () => {
    // Clear queue
    msgq = await jt400.openMessageQ({
      name: process.env.AS400_USERNAME || ''
    })

    const readnext = async () => {
      const message = await msgq.read()
      if (message) {
        return readnext()
      }
    }

    readnext()
  })

  it('should open a message queue and write/read a message.', async () => {
    const testMessage = 'Test Message'
    await msgq.sendInformational(testMessage)
    expect(await msgq.read()).to.equal(testMessage)
  }).timeout(5000)
})
