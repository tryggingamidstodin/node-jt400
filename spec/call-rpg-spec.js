'use strict';
var jt400 = require('../lib/jt400'),
	q = require('q');

function onError(that, done) {
	return function (err) {
		that.fail(err);
		done();
	};
}

describe('PGM', function () {
	it('should run rpg program', function (done) {
		var getIsk = jt400.pgm('GET_ISK', [{name: 'mynt', size: 3}]);
		q.all([getIsk({mynt: 'Kr.'}), getIsk({mynt: 'EUR'})]).then(function (result) {
			expect(result[0].mynt).toBe('ISK');
			expect(result[1].mynt).toBe('EUR');
			done();
		}).fail(onError(this, done));
	});

	it('should run GETNETFG', function (done) {
		var getNetfang = jt400.pgm('GETNETFG', [
			{name: 'kt', size: 10, decimals: 0},
			{name: 'email', size: 30},
			{name: 'valid', size: 1}]);
		getNetfang({kt: '0123456789'}).then(function (result) {
			expect(result.email).toBe('');
			expect(result.valid).toBe('J');
			done();
		}).fail(onError(this, done));
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
			expect(result.p1.txt1).toBe('tst');
			expect(result.p1.num1).toBe(401);
			expect(result.p1.num2).toBe(8);
			done();
		}).fail(onError(this, done));
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
			expect(result.p1.txt1).toBe('tst');
			expect(result.p1.num1).toBe(401);
			expect(result.p1.num2).toBe(8);
			done();
		}).fail(onError(this, done));
	});
});