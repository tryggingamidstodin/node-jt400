import { jt400 as connection } from './db'
import { pool, QueryOptions } from '..'
import { expect } from 'chai'
import { readFileSync } from 'fs'

describe('jt400 pool', () => {
  let idList

  beforeEach(() => {
    return connection
      .update('delete from tsttbl')
      .then(() => {
        const records = [
          { foo: 'bar', bar: 123, baz: '123.23' },
          { foo: 'bar2     ', bar: 124, baz: '321.32' },
        ]
        return connection.insertList('tsttbl', 'testtblid', records)
      })
      .then((idListResult) => (idList = idListResult))
  })

  it('should not be in memory', () => {
    expect(connection.isInMemory()).to.equal(false)
  })

  it('should not return same instance in configure', () => {
    expect(connection).to.not.equal(pool({ host: 'foo' }))
  })

  it('should configure host', () => {
    const db = pool({ host: 'nohost' })
    return db
      .query('select * from tsttbl')
      .then(() => {
        throw new Error('should not return result from nohost')
      })
      .catch((err) => {
        expect(err.message).to.equal('nohost')
        expect(err.category).to.equal('OperationalError')
      })
  }).timeout(20000)

  it('should insert records', () => {
    expect(idList.length).to.equal(2)
    expect(Number(idList[0])).to.be.above(1)
  })

  it('should execute query', async () => {
    const data = await connection.query('select * from tsttbl')
    expect(data.length).to.equal(2)
  })

  it('should trim values as default', async () => {
    const data: any = await connection.query(
      'select * from tsttbl order by bar'
    )
    expect(data.length).to.equal(2)
    expect(data[1].FOO).to.equal('bar2')
  })

  it('should trim values when options is empty', async () => {
    const data: any = await connection.query(
      'select * from tsttbl',
      [],
      {} as QueryOptions
    )
    expect(data.length).to.equal(2)
    expect(data[1].FOO).to.equal('bar2')
  })

  it('should trim values when trim is undefined', async () => {
    let trim
    const data: any = await connection.query(
      'select * from tsttbl order by bar',
      [],
      {
        trim,
      }
    )
    expect(data.length).to.equal(2)
    expect(data[1].FOO).to.equal('bar2')
  })

  it('should not trim values when trim option is false', async () => {
    const data: any = await connection.query(
      'select * from tsttbl order by bar',
      [],
      {
        trim: false,
      }
    )
    expect(data.length).to.equal(2)
    expect(data[1].FOO).to.equal('bar2     ')
  })

  it('should execute query with params', async () => {
    const data = await connection.query('select * from tsttbl where baz=?', [
      123.23,
    ])
    expect(data.length).to.equal(1)
  })

  it('should execute update', async () => {
    const nUpdated = await connection.update(
      "update tsttbl set foo='bar3' where foo='bar'"
    )
    expect(nUpdated).to.equal(1)
  })

  it('should execute update', async () => {
    const nUpdated = await connection.update(
      'update tsttbl set foo=? where testtblid=?',
      ['ble', 0]
    )
    expect(nUpdated).to.equal(0)
  })

  it('should insert dates and timestamps', () => {
    const params = [
      new Date(2014, 0, 15),
      new Date(2014, 0, 16, 15, 32, 5),
      'bar',
    ]
    return connection
      .update('update tsttbl set fra=?, timi=? where foo=?', params)
      .then(() => {
        return connection.query<any>(
          'select fra, timi from tsttbl where foo=?',
          ['bar']
        )
      })
      .then((res) => {
        expect(res[0].FRA).to.eql('2014-01-15')
        expect(res[0].TIMI).to.eql('2014-01-16 15:32:05.000000')
      })
  })

  it('should insert clob', async () => {
    const largeText = readFileSync(
      __dirname + '/../../test-data/clob.txt'
    ).toString()
    await connection.update('update tsttbl set clob=?', [
      { type: 'CLOB', value: largeText },
    ])
    const res: any = await connection.query('SELECT clob from tsttbl')
    expect(res[0].CLOB.length).to.equal(largeText.length)
  })

  it('should insert blob', async () => {
    const image = readFileSync(__dirname + '/../../test-data/blob.png', {
      encoding: 'base64',
    })

    await connection.update('update tsttbl set blob=?', [
      { type: 'BLOB', value: image },
    ])
    const res: any = await connection.query('SELECT blob from tsttbl')
    expect(res[0].BLOB.length).to.equal(image.length)
  })

  it('should fail query with oops error', () => {
    const sql = 'select * from tsttbl where baz=?'
    const params = [123.23, 'a']

    return connection
      .query(sql, params)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch((error) => {
        expect(error.message).to.equal('Descriptor index not valid.')
        expect(error.cause.stack).to.include('JdbcJsonClient.setParams')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
        expect(error.category).to.equal('ProgrammerError')
      })
  })

  it('should fail insert with oops error', () => {
    const sql = `insert into table testtable (foo) values (?)`
    const params = [123.23, 'a']
    return connection
      .insertAndGetId(sql, params)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch((error) => {
        expect(error.message).to.equal(
          '[SQL0104] Token TESTTABLE was not valid. Valid tokens: : <INTEGER>.'
        )
        expect(error.cause.stack).to.include('JdbcJsonClient.insertAndGetId')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
        expect(error.category).to.equal('ProgrammerError')
      })
  })

  it('should fail execute query with oops-error', () => {
    const sql = 'select * from tsttbl-invalidtoken'
    return connection
      .execute(sql)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch((error) => {
        expect(error.message).to.equal(
          '[SQL0104] Token - was not valid. Valid tokens: FOR USE SKIP WAIT WITH FETCH LIMIT ORDER UNION EXCEPT OFFSET.'
        )
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(undefined)
        expect(error.category).to.equal('ProgrammerError')
      })
  })

  it('should fail update', async () => {
    const sql = 'update tsttbl set foo=? where testtblid=?'
    const params = ['bar', 0, 'toomanyparams']
    return connection
      .update(sql, params)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch((error) => {
        expect(error.message).to.equal('Descriptor index not valid.')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
        expect(error.category).to.equal('ProgrammerError')
      })
  })
})
