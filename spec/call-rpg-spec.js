'use strict';
var config = require('../config'),
	jt400 = require('../lib/db2').init(config);

function onError(that, done) {
	return function (err) {
		that.fail(err);
		done();
	};
}

describe('PGM', function () {
	it('should run rpg program', function (done) {
		var getIsk = jt400.pgm('GET_ISK', [{name: 'mynt', size: 3}]);
		getIsk({mynt: 'Kr.'}).then(function (result) {
			expect(result.mynt).toBe('ISK');
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
			expect(result.valid).toBe('N');
			done();
		}).fail(onError(this, done));
	});
});