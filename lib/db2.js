'use strict';
var jvm = require('java'),
	sqlutil = require('./sqlutil'),
	_ = require('underscore'),
	Q = require('q');

jvm.classpath.push(__dirname + '/../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../java/lib/json-simple-1.1.1.jar');

function init(config) {
	var DB2 = jvm.import('nodejt400.DB2').getInstanceSync(JSON.stringify(config)),
		execQuery = DB2.executeQuery.bind(DB2),
		execUpdate = DB2.executeUpdate.bind(DB2);

	var as400 = {
		executeQuery: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execQuery, sql, jsonParams).then(JSON.parse);
		},
		executeUpdate: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execUpdate, sql, jsonParams);
		},
		insertList : function (tableName, idColumn, list) {
			var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + sqlutil.toInsertSql(tableName, list) + ')',
				params = _(list).chain().map(_.values).flatten().value();
			return as400.executeQuery(sql, params);
		}
	};
	return as400;
}

module.exports = {
	init: init
};
