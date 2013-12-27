/*global suite, set, bench, console */
'use strict';
var config = require('../config'),
	jt400 = require('../lib/db2').init(config);

suite('pgm', function () {
	var log = console.log.bind(console),
		getIsk = jt400.pgm('GET_ISK', [{name: 'mynt', size: 3}]);

	set('iterations', 1000);
	set('type', 'static');

	bench('call rpg', function (next) {
		getIsk({mynt: 'Kr.'}).then(function (result) {
			next();
		}).fail(log);
	});
});