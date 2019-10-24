import { jt400 } from './db'
import { expect } from 'chai'

describe('CMD', () => {
  it('should run command specified', async () => {
    const cmdTest = jt400.executeCmd({
      cmdString: `SBMJOB CMD(DSPOBJD OBJ(QSYS) OBJTYPE(*LIB) OUTPUT(*PRINT))`
    })
    const result = await Promise.all([cmdTest])
    expect(
      result[0][0].search(
        /Job [0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+ submitted to job queue [A-Z0-9]+ in library [A-Z0-9.]+/g
      )
    ).to.equal(0)
  }).timeout(15000)
})
