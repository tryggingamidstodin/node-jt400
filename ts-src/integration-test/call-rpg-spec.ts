import { expect } from 'chai'
import { jt400 } from './db'

describe('PGM', () => {
  it('should run rpg program', async () => {
    const getIsk = jt400.defineProgram({
      programName: 'GET_ISK',
      paramsSchema: [{ name: 'mynt', size: 3 }],
    })
    const result = await Promise.all([
      getIsk({ mynt: 'Kr.' }),
      getIsk({ mynt: 'EUR' }),
    ])
    expect(result[0].mynt).to.equal('ISK')
    expect(result[1].mynt).to.equal('EUR')
  }).timeout(15000)

  it('should run GETNETFG', async () => {
    const getNetfang = jt400.defineProgram({
      programName: 'GETNETFG',
      paramsSchema: [
        { name: 'kt', size: 10, decimals: 0 },
        { name: 'email', size: 30 },
        { name: 'valid', size: 1 },
      ],
    })
    const result = await getNetfang({ kt: '0123456789' })
    expect(result.valid).to.equal('J')
  })

  it('should run pgm with datastructure param', async () => {
    const tstDs = jt400.defineProgram({
      programName: 'TST_DS',
      paramsSchema: [
        {
          p1: [
            { name: 'txt1', size: 3 },
            { name: 'num1', size: 9, decimals: 0 },
            { name: 'num2', type: 'numeric', size: 9, decimals: 0 },
          ],
        },
      ],
    })

    const result = await tstDs({ p1: { txt1: 'tst', num1: 400, num2: 7 } })
    expect(result.p1.txt1).to.equal('tst')
    expect(result.p1.num1).to.equal(401)
    expect(result.p1.num2).to.equal(8)
  })

  it('should run pgm with datastructure param with columns format', async () => {
    const tstDs = jt400.defineProgram({
      programName: 'TST_DS',
      paramsSchema: [
        {
          p1: [
            { name: 'txt1', typeName: 'VARCHAR', precision: 3, scale: 0 },
            { name: 'num1', typeName: 'DECIMAL', precision: 9, scale: 0 },
            { name: 'num2', typeName: 'NUMERIC', precision: 9, scale: 0 },
          ],
        },
      ],
    })

    const result = await tstDs({ p1: { txt1: 'tst', num1: 400, num2: 7 } })
    expect(result.p1.txt1).to.equal('tst')
    expect(result.p1.num1).to.equal(401)
    expect(result.p1.num2).to.equal(8)
  })

  it('should get timeout errors', () => {
    const brokenProgram = jt400.pgm(
      'DTQHANG',
      [{ name: 'strengur', size: 7 }],
      'WTMEXC'
    )

    return brokenProgram({ strengur: 'abcd123' })
      .then(() => {
        throw new Error('Not the correct error')
      })
      .catch((e) => {
        expect(e.category).to.equal('OperationalError')
        expect(e).not.to.equal(null)
        expect(e.message).to.contain('Connection was dropped unexpectedly.')
      })
  })
})
