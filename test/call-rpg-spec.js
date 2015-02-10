'use strict';
var jt400 = require('../lib/jt400').pool(),
	q = require('q'),
	expect = require('chai').expect;

describe('PGM', function () {
	it('should run rpg program', function (done) {
		this.timeout(15000);
		var getIsk = jt400.pgm('GET_ISK', [{name: 'mynt', size: 3}]);
		q.all([getIsk({mynt: 'Kr.'}), getIsk({mynt: 'EUR'})]).then(function (result) {
			expect(result[0].mynt).to.equal('ISK');
			expect(result[1].mynt).to.equal('EUR');
		}).then(done, done);
	});

	it('should run GETNETFG', function (done) {
		var getNetfang = jt400.pgm('GETNETFG', [
			{name: 'kt', size: 10, decimals: 0},
			{name: 'email', size: 30},
			{name: 'valid', size: 1}]);
		getNetfang({kt: '0123456789'}).then(function (result) {
			expect(result.valid).to.equal('J');
		}).then(done, done);
	});

	it('should run pgm with datastructure param', function (done) {
		var tstDs = jt400.pgm('TST_DS', [
				{p1: [
					{name: 'txt1', size: 3},
					{name: 'num1', size: 9, decimals: 0},
					{name: 'num2', type: 'numeric', size: 9, decimals: 0}
				]}
			]);
		tstDs({p1: {txt1: 'tst', num1: 400, num2: 7}}).then(function (result) {
			expect(result.p1.txt1).to.equal('tst');
			expect(result.p1.num1).to.equal(401);
			expect(result.p1.num2).to.equal(8);
		}).then(done, done);
	});

	it('should run pgm with datastructure param with columns format', function (done) {
		var tstDs = jt400.pgm('TST_DS', [
				{p1: [
					{name: 'txt1', typeName: 'VARCHAR', precision: 3, scale: 0},
					{name: 'num1', typeName: 'DECIMAL', precision: 9, scale: 0},
					{name: 'num2', typeName: 'NUMERIC', precision: 9, scale: 0}
				]}
			]);
		tstDs({p1: {txt1: 'tst', num1: 400, num2: 7}}).then(function (result) {
			expect(result.p1.txt1).to.equal('tst');
			expect(result.p1.num1).to.equal(401);
			expect(result.p1.num2).to.equal(8);
		}).then(done, done);
	});
});