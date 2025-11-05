import assert from 'assert'
import { readFileSync } from 'fs'
import { getCurrentDir } from '../lib/pathUtils'
import { pool, QueryOptions } from '../index'
import { jt400 as connection } from './db'

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
    assert.strictEqual(connection.isInMemory(), false)
  })

  it('should not return same instance in configure', () => {
    assert.notStrictEqual(connection, pool({ host: 'foo' }))
  })

  it('should configure host', () => {
    const db = pool({ host: 'nohost' })
    return db
      .query('select * from tsttbl')
      .then(() => {
        throw new Error('should not return result from nohost')
      })
      .catch((err) => {
        assert.ok(err.message.includes('nohost'))
        assert.strictEqual(err.category, 'OperationalError')
      })
  }).timeout(20000)

  it('should insert records', () => {
    assert.strictEqual(idList.length, 2)
    assert.ok(Number(idList[0]) > 1)
  })

  it('should execute query', async () => {
    const data = await connection.query('select * from tsttbl')
    assert.strictEqual(data.length, 2)
  })

  it('should trim values as default', async () => {
    const data: any = await connection.query(
      'select * from tsttbl order by bar',
    )
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[1].FOO, 'bar2')
  })

  it('should trim values when options is empty', async () => {
    const data: any = await connection.query(
      'select * from tsttbl',
      [],
      {} as QueryOptions,
    )
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[1].FOO, 'bar2')
  })

  it('should trim values when trim is undefined', async () => {
    let trim
    const data: any = await connection.query(
      'select * from tsttbl order by bar',
      [],
      {
        trim,
      },
    )
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[1].FOO, 'bar2')
  })

  it('should not trim values when trim option is false', async () => {
    const data: any = await connection.query(
      'select * from tsttbl order by bar',
      [],
      {
        trim: false,
      },
    )
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[1].FOO, 'bar2     ')
  })

  it('should execute query with params', async () => {
    const data = await connection.query('select * from tsttbl where baz=?', [
      123.23,
    ])
    assert.strictEqual(data.length, 1)
  })

  it('should execute update', async () => {
    const nUpdated = await connection.update(
      "update tsttbl set foo='bar3' where foo='bar'",
    )
    assert.strictEqual(nUpdated, 1)
  })

  it('should execute update with parameters', async () => {
    const nUpdated = await connection.update(
      'update tsttbl set foo=? where testtblid=?',
      ['ble', 0],
    )
    assert.strictEqual(nUpdated, 0)
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
          ['bar'],
        )
      })
      .then((res) => {
        assert.deepStrictEqual(res[0].FRA, '2014-01-15')
        assert.deepStrictEqual(res[0].TIMI, '2014-01-16 15:32:05.000000')
      })
  })

  it('should insert clob', async () => {
    const largeText = readFileSync(
      getCurrentDir() + '/test-data/clob.txt',
    ).toString()
    await connection.update('update tsttbl set clob=?', [
      { type: 'CLOB', value: largeText },
    ])
    const res: any = await connection.query('SELECT clob from tsttbl')
    assert.strictEqual(res[0].CLOB.length, largeText.length)
  }).timeout(20000)

  it('should insert blob', async () => {
    const image = readFileSync(getCurrentDir() + '/test-data/blob.png', {
      encoding: 'base64',
    })

    await connection.update('update tsttbl set blob=?', [
      { type: 'BLOB', value: image },
    ])
    const res: any = await connection.query('SELECT blob from tsttbl')
    assert.strictEqual(res[0].BLOB.length, image.length)
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
        assert.strictEqual(error.message, 'Descriptor index not valid.')
        assert.ok(error.cause.stack.includes('JdbcJsonClient.setParams'))
        assert.strictEqual(error.context.sql, sql)
        assert.strictEqual(error.context.params, params)
        assert.strictEqual(error.category, 'ProgrammerError')
      })
  })

  it('should fail insert with oops error', () => {
    const sql = 'insert into table testtable (foo) values (?)'
    const params = [123.23, 'a']
    return connection
      .insertAndGetId(sql, params)
      .then(() => {
        throw new Error('wrong error')
      })
      .catch((error) => {
        assert.strictEqual(
          error.message,
          '[SQL0104] Token TESTTABLE was not valid. Valid tokens: : <INTEGER>.',
        )
        assert.ok(error.cause.stack.includes('JdbcJsonClient.insertAndGetId'))
        assert.strictEqual(error.context.sql, sql)
        assert.strictEqual(error.context.params, params)
        assert.strictEqual(error.category, 'ProgrammerError')
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
        assert.strictEqual(
          error.message,
          '[SQL0104] Token - was not valid. Valid tokens: AS CL ID IN TO ASC END FOR KEY LAG LOG NEW OFF OLD OUT COPY DATA.',
        )
        assert.strictEqual(error.context.sql, sql)
        assert.deepStrictEqual(error.context.params, [])
        assert.strictEqual(error.category, 'ProgrammerError')
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
        assert.strictEqual(error.message, 'Descriptor index not valid.')
        assert.strictEqual(error.context.sql, sql)
        assert.strictEqual(error.context.params, params)
        assert.strictEqual(error.category, 'ProgrammerError')
      })
  })
})
