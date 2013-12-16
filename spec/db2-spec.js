'use strict';
var config = require('../config'),
	db2 = require('../db2').init(config);

describe('db2', function () {

	it('should config', function (done) {
		db2.executeQuery('select * from tsttblfd', function (err, data) {
			console.log(err, data);
			done();
		});
	});

});