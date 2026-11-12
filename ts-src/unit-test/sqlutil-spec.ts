import { describe, it } from 'node:test'
import { toInsertSql } from '../lib/sqlutil.js'
import assert from 'assert'

describe('sql helpers', () => {
  it('should create sql statement', () => {
    const records = [
      {
        foo: 'bar',
        baz: 123,
      },
      {
        foo: 'ble',
        baz: 456,
      },
    ]
    assert.strictEqual(
      toInsertSql('myTable', records),
      'INSERT INTO myTable (foo, baz) VALUES(?, ?), (?, ?)',
    )
  })
})
