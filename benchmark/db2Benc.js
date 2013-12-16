'use strict';
var config = require('../config'),
	db2 = require('../db2').init(config);

suite('execute query', function () {
	set('iterations', 100);
	set('type', 'static');
	
	bench('return json', function (next) {
		db2.executeQuery('select * from tsttbl', function (err, data) {
			next();
		});
	});
});