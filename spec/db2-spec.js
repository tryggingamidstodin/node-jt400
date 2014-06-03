'use strict';
var jt400 = require('../lib/jt400');

function wrap(fn) {
	return function () {
		return fn();
	};
}

function onFail(that, done) {
	return function (err) {
		that.fail(err);
		done();
	};
}

describe('jt400', function () {
	var idList;

	beforeEach(function (done) {
		jt400.configure({});
		jt400.update('delete from tsttbl')
		.then(function () {
			var records = [{foo: 'bar', bar: 123, baz: '123.23'},
							{foo: 'bar2', bar: 124, baz: '321.32'}];
			return jt400.insertList('tsttbl', 'testtblid', records);
		})
		.then(function (idListResult) {
			idList = idListResult;
			done();
		})
		.fail(onFail(this, done));
	});

	it('should return same instance in configure', function () {
		expect(jt400).toBe(jt400.configure({host: 'foo'}));
	});

	it('should configure host', function (done) {
		jt400.configure({host: 'nohost'});
		jt400.query('select * from tsttbl').then(function (res) {
			done(new Error('should not return result from nohost'));
		}).fail(function (err) {
			expect(err.message).toMatch('cannot establish the connection');
			done();
		});
	});

	it('should insert records', function () {
		expect(idList.length).toBe(2);
		expect(idList[0]).toBeGreaterThan(1);
	});

	it('should execute query', function (done) {
		jt400.query('select * from tsttbl').then( function (data) {
			expect(data.length).toBe(2);
			done();
		}, onFail(this, done));
	});

	it('should execute query with params', function (done) {
		jt400.query('select * from tsttbl where baz=?', [123.23]).then( function (data) {
			expect(data.length).toBe(1);
			done();
		}, onFail(this, done));
	});

	it('should execute update', function (done) {
		jt400.update('update tsttbl set foo=\'bar3\' where foo=\'bar\'')
			.then(function (nUpdated) {
				expect(nUpdated).toBe(1);
				done();
			}, onFail(this, done));
	});

	it('should execute update', function (done) {
		jt400.update('update tsttbl set foo=? where testtblid=?', ['ble', 0])
			.then(function (nUpdated) {
				expect(nUpdated).toBe(0);
				done();
			}, onFail(this, done));
	});

	it('should insert dates and timestamps', function (done) {
		var params = [new Date(2014, 0, 15), new Date(2014, 0, 16, 15, 32, 5), 'bar'];
		jt400.update('update tsttbl set fra=?, timi=? where foo=?', params)
			.then(function (nUpdated) {
				return jt400.query('select fra, timi from tsttbl where foo=?', ['bar']);
			})
			.then(function (res) {
				expect(res[0].FRA).toEqual('2014-01-15');
				expect(res[0].TIMI).toEqual('2014-01-16 15:32:05.000000');
				done();
			}, onFail(this, done));
	});


});