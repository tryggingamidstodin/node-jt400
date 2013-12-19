'use strict';
var config = require('../config'),
	db2 = require('../lib/db2').init(config);

function wrap(fn) {
	return function () {
		return fn();
	};
}

function onFail(done) {
	return function (err) {
		console.log(err);
		expect(true).toBe(false);
		done();
	};
}

describe('db2', function () {
	var idList;

	beforeEach(function (done) {
		db2.executeUpdate('delete from tsttbl')
		.then(function () {
			var records = [{foo: 'bar', bar: 123, baz: '123.23'},
							{foo: 'bar2', bar: 124, baz: '321.32'}];
			return db2.insertList('tsttbl', 'testtblid', records);
		})
		.then(function (idListResult) {
			idList = idListResult;
			done();
		})
		.fail(onFail(done));
	});

	it('should insert records', function () {
		expect(idList.length).toBe(2);
		expect(idList[0]).toBeGreaterThan(1);
	});

	it('should execute query', function (done) {
		db2.executeQuery('select * from tsttbl').then( function (data) {
			expect(data.length).toBe(2);
			done();
		}, onFail(done));
	});

	it('should execute query with params', function (done) {
		db2.executeQuery('select * from tsttbl where baz=?', [123.23]).then( function (data) {
			expect(data.length).toBe(1);
			done();
		}, onFail(done));
	});

	it('should execute update', function (done) {
		db2.executeUpdate('update tsttbl set foo=\'bar3\' where foo=\'bar\'')
			.then(function (nUpdated) {
				expect(nUpdated).toBe(1);
				done();
			}, onFail(done));
	});

	it('should execute update', function (done) {
		db2.executeUpdate('update tsttbl set foo=? where testtblid=?', ['ble', 0])
			.then(function (nUpdated) {
				expect(nUpdated).toBe(0);
				done();
			}, onFail(done));
	});


});