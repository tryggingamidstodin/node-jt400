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
		execQuery = DB2.query.bind(DB2),
		execUpdate = DB2.update.bind(DB2);

	var as400 = {
		query: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execQuery, sql, jsonParams).then(JSON.parse);
		},
		update: function (sql, params) {
			var jsonParams = JSON.stringify(params || []);
			return Q.nfcall(execUpdate, sql, jsonParams);
		},
		insertList : function (tableName, idColumn, list) {
			var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + sqlutil.toInsertSql(tableName, list) + ')',
				params = _(list).chain().map(_.values).flatten().value();
			return as400.query(sql, params).then(function (idList) {
				return idList.map(function (idObj) {
					return idObj[idColumn.toUpperCase()];
				});
			});
		},
		pgm: function (programName, paramsSchema) {
			var pgm = DB2.pgmSync(programName, JSON.stringify(paramsSchema)),
				pgmFunc = pgm.run.bind(pgm);
			return function (params) {
				return Q.nfcall(pgmFunc, JSON.stringify(params)).then(JSON.parse);
			};
		}
	};
	return as400;
}

module.exports = {
	init: init
};
