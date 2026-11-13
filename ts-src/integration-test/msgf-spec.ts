import assert from 'assert'
import { describe, it } from 'node:test'
import { jt400 } from './db.js'

describe('MessageFileHandler', async function () {
  it(
    'should open a message file and read an id',
    { timeout: 5000 },
    async () => {
      const file = await jt400.openMessageFile({
        path: '/QSYS.LIB/QCPFMSG.MSGF',
      })
      const msg = await file.read({ messageId: 'CPF2105' })
      const expectedText = 'Object &1 in &2 type *&3 not found.'
      const text = await msg.getText()
      assert.strictEqual(text, expectedText)
    },
  )
})
