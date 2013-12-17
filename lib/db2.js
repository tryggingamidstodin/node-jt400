'use strict';
var jvm = require('java'),
	Q = require('q');

jvm.classpath.push(__dirname + '/../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../java/lib/json-simple-1.1.1.jar');

function init(config) {
	var DB2 = jvm.import('nodejt400.DB2').getInstanceSync(JSON.stringify(config)),
		execQuery = DB2.executeQuery.bind(DB2),
		execUpdate = DB2.executeUpdate.bind(DB2);
	return {
		executeQuery: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execQuery, sql, jsonParams).then(JSON.parse);
		},
		executeUpdate: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execUpdate, sql, jsonParams);
		}
	};
}

module.exports = {
	init: init
};
