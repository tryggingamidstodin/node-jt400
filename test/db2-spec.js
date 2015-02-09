'use strict';
var jt400 = require('../lib/jt400'),
	expect = require('chai').expect;

describe('jt400', function () {
	var idList;

	beforeEach(function (done) {
		this.timeout(5000);
		jt400.configure({});
		jt400.update('delete from tsttbl')
		.then(function () {
			var records = [{foo: 'bar', bar: 123, baz: '123.23'},
							{foo: 'bar2', bar: 124, baz: '321.32'}];
			return jt400.insertList('tsttbl', 'testtblid', records);
		})
		.then(function (idListResult) {
			idList = idListResult;
		}).then(done, done);
	});

    it('should not be in memory', function () {
        expect(jt400.isInMemory()).to.not.be.ok();
    });

	it('should return same instance in configure', function () {
		expect(jt400).to.equal(jt400.configure({host: 'foo'}));
	});

	it('should configure host', function (done) {
		this.timeout(15000);
		jt400.configure({host: 'nohost'});
		jt400.query('select * from tsttbl').then(function () {
			done(new Error('should not return result from nohost'));
		}).fail(function (err) {
			expect(err.message).to.have.string('cannot establish the connection');
			done();
		}).fail(done);
	});

	it('should insert records', function () {
		expect(idList.length).to.equal(2);
		expect(idList[0]).to.be.above(1);
	});

	it('should execute query', function (done) {
		jt400.query('select * from tsttbl').then( function (data) {
			expect(data.length).to.equal(2);
		}).then(done, done);
	});

	it('should execute query with params', function (done) {
		jt400.query('select * from tsttbl where baz=?', [123.23]).then( function (data) {
			expect(data.length).to.equal(1);
		}).then(done, done);
	});

	it('should execute update', function (done) {
		jt400.update('update tsttbl set foo=\'bar3\' where foo=\'bar\'')
			.then(function (nUpdated) {
				expect(nUpdated).to.equal(1);
			}).then(done, done);
	});

	it('should execute update', function (done) {
		jt400.update('update tsttbl set foo=? where testtblid=?', ['ble', 0])
			.then(function (nUpdated) {
				expect(nUpdated).to.equal(0);
			}).then(done, done);
	});

	it('should insert dates and timestamps', function (done) {
		var params = [new Date(2014, 0, 15), new Date(2014, 0, 16, 15, 32, 5), 'bar'];
		jt400.update('update tsttbl set fra=?, timi=? where foo=?', params)
			.then(function () {
				return jt400.query('select fra, timi from tsttbl where foo=?', ['bar']);
			})
			.then(function (res) {
				expect(res[0].FRA).to.eql('2014-01-15');
				expect(res[0].TIMI).to.eql('2014-01-16 15:32:05.000000');
			}).then(done, done);
	});


});