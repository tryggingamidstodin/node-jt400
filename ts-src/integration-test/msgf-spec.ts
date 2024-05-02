import { jt400 } from './db'
import { expect } from 'chai'

describe('MessageFileHandler', async function () {
  it('should open a message file and read an id', async () => {
    const file = await jt400.openMessageFile({ path: '/QSYS.LIB/QCPFMSG.MSGF' })
    const msg = await file.read({ messageId: 'CPF2105' })
    const expectedText = 'Object &1 in &2 type *&3 not found.'
    const text = await msg.getText()
    expect(text).to.equal(expectedText)
  }).timeout(5000)
})
