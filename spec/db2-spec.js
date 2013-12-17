'use strict';
var config = require('../config'),
	db2 = require('../lib/db2').init(config);

function onFail(done) {
	return function (err) {
		console.log(err);
		done();
	};
}

describe('db2', function () {

	it('should execute query', function (done) {
		db2.executeQuery('select * from tsttbl').then( function (data) {
			console.log(data);
			done();
		}, onFail(done));
	});

	it('should execute update', function (done) {
		db2.executeUpdate('update tsttbl set foo=\'bar\' where testtblid=1732')
			.then(function (nUpdated) {
				expect(nUpdated).toBe(1);
				done();
			}, onFail(done));
	});

});