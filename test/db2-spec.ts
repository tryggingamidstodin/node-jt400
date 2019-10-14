import { jt400 as connection } from './db'
import { pool, connect } from '../lib/jt400'
import { expect } from 'chai'
import { readFileSync } from 'fs'

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
      .catch(err => {
        expect(err.message).to.equal('Failed to update')
        expect(err.cause.stack).to.have.string('connection does not exist')
      })
  }).timeout(6000)
})

describe('jt400 pool', () => {
  let idList

  beforeEach(() => {
    return connection
      .update('delete from tsttbl')
      .then(() => {
        const records = [
          { foo: 'bar', bar: 123, baz: '123.23' },
          { foo: 'bar2', bar: 124, baz: '321.32' }
        ]
        return connection.insertList('tsttbl', 'testtblid', records)
      })
      .then(idListResult => (idList = idListResult))
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
      .catch(err => {
        expect(err.message).to.equal('Failed to query')
        expect(err.cause.stack).to.have.string(
          'cannot establish the connection'
        )
      })
  }).timeout(15000)

  it('should insert records', () => {
    expect(idList.length).to.equal(2)
    expect(Number(idList[0])).to.be.above(1)
  })

  it('should execute query', async () => {
    const data = await connection.query('select * from tsttbl')
    expect(data.length).to.equal(2)
  })

  it('should execute query with params', async () => {
    const data = await connection.query('select * from tsttbl where baz=?', [
      123.23
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
      'bar'
    ]
    return connection
      .update('update tsttbl set fra=?, timi=? where foo=?', params)
      .then(() => {
        return connection.query<any>(
          'select fra, timi from tsttbl where foo=?',
          ['bar']
        )
      })
      .then(res => {
        expect(res[0].FRA).to.eql('2014-01-15')
        expect(res[0].TIMI).to.eql('2014-01-16 15:32:05.000000')
      })
  })

  it('should insert clob', async () => {
    const largeText = readFileSync(
      __dirname + '/../../test-data/clob.txt'
    ).toString()
    await connection.update('update tsttbl set clob=?', [
      { type: 'CLOB', value: largeText }
    ])
    const res: any = await connection.query('SELECT clob from tsttbl')
    expect(res[0].CLOB.length).to.equal(largeText.length)
  })

  it('should fail query with oops error', () => {
    const sql = 'select * from tsttbl where baz=?'
    const params = [123.23, 'a']

    return connection
      .query(sql, params)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch(error => {
        expect(error.message).to.equal('Failed to query')
        expect(error.cause.stack).to.include('JdbcJsonClient.setParams')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
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
      .catch(error => {
        expect(error.message).to.equal('Failed to insert and get id')
        expect(error.cause.stack).to.include('JdbcJsonClient.insertAndGetId')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
      })
  })

  it('should fail execute query with oops-error', () => {
    const sql = 'select * from tsttbl-invalidtoken'
    return connection
      .execute(sql)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch(error => {
        expect(error.message).to.equal('Failed to execute')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(undefined)
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
      .catch(error => {
        expect(error.message).to.equal('Failed to update')
        expect(error.context.sql).to.equal(sql)
        expect(error.context.params).to.equal(params)
      })
  })
})
