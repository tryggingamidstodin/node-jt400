'use strict';
var config = require('../config'),
	db2 = require('../db2').init(config);

describe('db2', function () {

	it('should config', function (done) {
		db2.executeQuery('select * from tsttbl').then( function (data) {
			console.log(data);
			done();
		});
	});

});