'use strict';
import { toInsertSql } from '../lib/sqlutil'
import { expect } from 'chai'

describe('sql helpers', function () {
	it('should create sql statement', function () {
		var records = [ {foo: 'bar', baz: 123},
						{foo: 'ble', baz: 456}];
		expect(toInsertSql('myTable', records))
			.to.equal('INSERT INTO myTable (foo, baz) VALUES(?, ?), (?, ?)');
	});
});