'use strict';
import { toInsertSql } from '../lib/sqlutil'
import { expect } from 'chai'

describe('sql helpers', () => {
	it('should create sql statement', () => {
		const records = [{
			foo: 'bar', 
			baz: 123
		},{
			foo: 'ble',
			baz: 456
		}];
		expect(toInsertSql('myTable', records))
			.to.equal('INSERT INTO myTable (foo, baz) VALUES(?, ?), (?, ?)');
	});
});