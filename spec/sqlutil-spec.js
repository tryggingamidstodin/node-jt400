'use strict';
var sqlutil = require('../lib/sqlutil');

describe('sql helpers', function () {
	it('should create sql statement', function () {
		var records = [ {foo: 'bar', baz: 123},
						{foo: 'ble', baz: 456}];
		expect(sqlutil.toInsertSql('myTable', records))
			.toBe('INSERT INTO myTable (foo, baz) VALUES(?, ?), (?, ?)');
	});
});