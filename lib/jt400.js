'use strict';
var jvm = require('java'),
	sqlutil = require('./sqlutil'),
	_ = require('underscore'),
	Q = require('q'),
	_CONN,
	defaultConfig = {
		host: process.env.AS400_HOST,
		user: process.env.AS400_USERNAME,
		password: process.env.AS400_PASSWORD
	};

jvm.classpath.push(__dirname + '/../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../java/lib/json-simple-1.1.1.jar');

function createCon(config) {
	var con = jvm.import('nodejt400.JT400').getInstanceSync(JSON.stringify(config));

	_CONN = {
		connection: con,
		query: con.query.bind(con),
		update: con.update.bind(con)
	};
	return _CONN;
}

function getCon() {
	if(_CONN) {
		return _CONN;
	}
	return createCon(defaultConfig);
}

var jt400 = {
	configure: function (config) {
		createCon(_.defaults(config, defaultConfig));
		return jt400;
	},
	query: function (sql, params) {
		var jsonParams = JSON.stringify(params || []);
		return Q.nfcall(getCon().query, sql, jsonParams).then(JSON.parse);
	},
	update: function (sql, params) {
		var jsonParams = JSON.stringify(params || []);
		return Q.nfcall(getCon().update, sql, jsonParams);
	},
	insertList : function (tableName, idColumn, list) {
		var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + sqlutil.toInsertSql(tableName, list) + ')',
			params = _(list).chain().map(_.values).flatten().value();
		return jt400.query(sql, params).then(function (idList) {
			return idList.map(function (idObj) {
				return idObj[idColumn.toUpperCase()];
			});
		});
	},
	pgm: function (programName, paramsSchema) {
		var pgm = getCon().connection.pgmSync(programName, JSON.stringify(paramsSchema)),
			pgmFunc = pgm.run.bind(pgm);
		return function (params) {
			return Q.nfcall(pgmFunc, JSON.stringify(params)).then(JSON.parse);
		};
	}
};

module.exports = jt400;