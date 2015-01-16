'use strict';
var jvm = require('java'),
	sqlutil = require('./sqlutil'),
	JdbcStream = require('./jdbcstream'),
	JSONStream = require('JSONStream'),
	_ = require('underscore'),
	Q = require('q'),
	defaultConfig = {
		host: process.env.AS400_HOST,
		user: process.env.AS400_USERNAME,
		password: process.env.AS400_PASSWORD
	};

jvm.options.push('-Xrs'); // fixing the signal handling issues (for exmaple ctrl-c)

jvm.classpath.push(__dirname + '/../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../java/lib/json-simple-1.1.1.jar');
jvm.classpath.push(__dirname + '/../java/lib/hsqldb.jar');

function createConFrom(con) {
	return {
		connection: con,
		query: con.query.bind(con),
		update: con.update.bind(con),
		insertAndGetId: con.insertAndGetId.bind(con),
		getColumns: con.getColumns.bind(con),
		getPrimaryKeys: con.getPrimaryKeys.bind(con),
		createKeyedDataQ: con.createKeyedDataQSync.bind(con)
	};
}

function createCon(config) {
	var con = jvm.import('nodejt400.JT400').getInstanceSync(JSON.stringify(config));
	return createConFrom(con);
}

function insertListInOneStatment(jt400, tableName, idColumn, list) {
	if(!list || list.length===0) {
		return new Q([]);
	}
	var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + sqlutil.toInsertSql(tableName, list) + ')',
		params = _(list).chain().map(_.values).flatten().value();
	return jt400.query(sql, params).then(function (idList) {
		return idList.map(function (idObj) {
			return idObj[idColumn.toUpperCase()];
		});
	});
}

function standardInsertList(jt400, tableName, idColumn, list) {
	var idList = [],
		pushToIdList = idList.push.bind(idList);
	return list.map(function (record) {
		return {
			sql: sqlutil.toInsertSql(tableName, [record]),
			values: _.values(record)
		};
	}).reduce(function (soFar, sqlObj) {
		return soFar.then(function () {
			return jt400.insertAndGetId(sqlObj.sql, sqlObj.values);
		})
		.then(pushToIdList);
	}, new Q())
	.then(function () {return idList;});
}


function paramsToJson(params) {
	return JSON.stringify((params || []).map(function (v) {
		return (v instanceof Date) ? v.toISOString().replace('T', ' ').replace('Z', '') : v;
	}));
}


function createInstance(getConn, insertListFun, inMemory) {
	var mixinConnection = function (obj, newGetConn) {
		var thisGetConn = function () {
			return newGetConn ? newGetConn() : getConn();
		};
		obj.query = function (sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisGetConn().query, sql, jsonParams).then(JSON.parse);
		};
		obj.update = function (sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisGetConn().update, sql, jsonParams);
		};
		obj.insertAndGetId = function (sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisGetConn().insertAndGetId, sql, jsonParams);
		};
		obj.insertList = function (tableName, idColumn, list) {
			return insertListFun(obj, tableName, idColumn, list);
		};
		obj.isInMemory = function () {
			return inMemory;
		};
		return obj;
	};

	var jt400 = mixinConnection({
		configure: function (config) {
			getConn = _.once(function () {
				return createCon(_.defaults(config, defaultConfig));
			});
			return jt400;
		},
		useInMemoryDb: function () {
			return createInstance(_.once(function () {
				return createConFrom(jvm.newInstanceSync('nodejt400.HsqlClient'));
			}), standardInsertList, true);
		},
		transaction: function (transactionFunction) {
			var t = getConn().connection.createTransactionSync(),
				c = {
					update: t.update.bind(t),
					insertAndGetId: t.insertAndGetId.bind(t),
					query: t.query.bind(t)
				},
				transaction = mixinConnection({
					commit: function () {
						t.commitSync();
					},
					rollback: function () {
						t.rollbackSync();
					}
				}, function () {return c;});
			return transactionFunction(transaction)
			.then(function (res) {
				t.commitSync();
				t.endSync();
				return res;
			})
			.fail(function (err) {
				t.rollbackSync();
				t.endSync();
				throw err;
			});
		},
		executeAsStream: function () {
			var options;
			if(arguments[0] === Object(arguments[0])) {
				options = arguments[0];
				options.objectMode = options.objectMode !== false;
			} else {
				options = {
					sql: arguments[0],
					params: arguments[1],
					objectMode: true
				};
			}
			var jsonParams = paramsToJson(options.params || []);
			var jdbcStream = new JdbcStream({
				jdbcStream: getConn().connection.executeAsStreamSync(options.sql, jsonParams, options.bufferSize || 100, options.metadata || false)
			});
			if(options.objectMode) {
				var objectStream = jdbcStream.pipe(JSONStream.parse([true]));
				objectStream.close = jdbcStream.close.bind(jdbcStream);
				return objectStream;
			}
			return jdbcStream;
		},
		getTablesAsStream: function (opt) {
			return new JdbcStream({
				jdbcStream: getConn().connection.getTablesAsStreamSync(opt.catalog, opt.schema, opt.table || '%')
			}).pipe(JSONStream.parse([true]));
		},
		getColumns: function (opt) {
			return Q.nfcall(getConn().getColumns, opt.catalog, opt.schema, opt.table, opt.columns || '%').then(JSON.parse);
		},
		getPrimaryKeys: function (opt) {
			return Q.nfcall(getConn().getPrimaryKeys, opt.catalog, opt.schema, opt.table).then(JSON.parse);
		},
		createKeyedDataQ: function (opt) {
			var dq = getConn().createKeyedDataQ(opt.name),
				read = dq.read.bind(dq);
			return {
				write: function (key, data) {
					dq.writeSync(key, data);
				},
				read: function () {
					var wait = -1, key;
					if(arguments[0] === Object(arguments[0])){
						key = arguments[0].key;
						wait = arguments[0].wait || wait;
					} else {
						key = arguments[0];
					}
					return Q.nfcall(read, key, wait);
				}
			};
		},
		pgm: function (programName, paramsSchema) {
			var pgm = getConn().connection.pgmSync(programName, JSON.stringify(paramsSchema)),
				pgmFunc = pgm.run.bind(pgm);
			return function (params) {
				return Q.nfcall(pgmFunc, JSON.stringify(params)).then(JSON.parse);
			};
		}
	});
	return jt400;
}

module.exports = createInstance(_.once(function () {
	return createCon(defaultConfig);
}), insertListInOneStatment);
