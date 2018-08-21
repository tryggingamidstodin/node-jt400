import { Readable, Writable } from 'stream'
import { JdbcStream } from './jdbcstream'
import { ifs as createIfs } from './ifs'
import { toInsertSql } from './sqlutil'
import { createJdbcWriteStream } from './jdbcwritestream'
import JSONStream = require('JSONStream')
import { defaults } from './defaults'
import Q = require('q')
const { promisify } = require('util');

const defaultConfig = {
	host: process.env.AS400_HOST,
	user: process.env.AS400_USERNAME,
	password: process.env.AS400_PASSWORD,
	naming: 'system'
}

/**
 * Creates a new simplified javascript object from the imported (Java Class) javascript object.
 * @param con The imported Java Connection Class
 */
function createConFrom(con) {
	return {
		connection: con,
		query: con.query.bind(con),
		queryAsStream: con.queryAsStream.bind(con),
		update: con.update.bind(con),
		batchUpdate: con.batchUpdate.bind(con),
		execute: con.execute.bind(con),
		insertAndGetId: con.insertAndGetId.bind(con),
		getColumns: con.getColumns.bind(con),
		getPrimaryKeys: con.getPrimaryKeys.bind(con),
		createKeyedDataQ: con.createKeyedDataQSync.bind(con),
		openMessageFile: con.openMessageFileSync.bind(con)
	};
}

function values(list) {
	return Object.keys(list).map(function(k) {
		return list[k];
	});
}

function insertListInOneStatment(jt400, tableName, idColumn, list) {
	if (!list || list.length === 0) {
		return new Q([]);
	}
	var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + toInsertSql(tableName, list) + ')',
		params = list.map(values).reduce(function(arr, valueArr) {
			return arr.concat(valueArr);
		}, []);
	return jt400.query(sql, params).then(function(idList) {
		return idList.map(function(idObj) {
			return idObj[idColumn.toUpperCase()];
		});
	});
}

function standardInsertList(jt400, tableName, _, list) {
	var idList = [],
		pushToIdList = idList.push.bind(idList);
	return list.map(function(record) {
		return {
			sql: toInsertSql(tableName, [record]),
			values: values(record)
		};
	}).reduce(function(soFar, sqlObj) {
		return soFar.then(function() {
			return jt400.insertAndGetId(sqlObj.sql, sqlObj.values);
		})
			.then(pushToIdList);
	}, new Q())
		.then(function() { return idList; });
}

function convertDateValues(v) {
	return (v instanceof Date) ? v.toISOString().replace('T', ' ').replace('Z', '') : v;
}

function paramsToJson(params) {
	return JSON.stringify((params || []).map(convertDateValues));
}

function createInstance(connection, insertListFun, inMemory) {
	var mixinConnection = function(obj, newConn?) {
		var thisConn = newConn || connection;
		obj.query = function(sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisConn.query, sql, jsonParams).then(JSON.parse);
		};
		obj.createReadStream = function(sql, params) {
			var jsonParams = paramsToJson(params || []);
			return new JdbcStream({
				jdbcStreamPromise: Q.nfcall(thisConn.queryAsStream, sql, jsonParams, 100)
			});
		};
		obj.queryAsStream = obj.createReadStream;
		obj.execute = function(sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisConn.execute, sql, jsonParams).then(function(statement) {
				var isQuery = statement.isQuerySync(),
					metadata = statement.getMetaData.bind(statement),
					updated = statement.updated.bind(statement),
					stream;
				var stWrap = {
					isQuery: function() {
						return isQuery;
					},
					metadata: function() {
						return Q.nfcall(metadata).then(JSON.parse);
					},
					asArray: () => Q.nfcall(statement.asArray.bind(statement)).then(JSON.parse),
					asStream: function(options) {
						options = options || {};
						stream = new JdbcStream({
							jdbcStream: statement.asStreamSync(options.bufferSize || 100)
						});
						return stream;
					},
					updated: function() {
						return Q.nfcall(updated);
					},
					close: function() {
						if (stream) {
							stream.close();
						} else {
							statement.close(function(err) {
								if (err) {
									console.log('close error', err);
								}
							});
						}
					}
				};
				return stWrap;
			});
		};
		obj.update = function(sql, params) {
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisConn.update, sql, jsonParams);
		};
		obj.createWriteStream = function(sql, options) {
			return createJdbcWriteStream(obj.batchUpdate, sql, options && options.bufferSize);
		};
		obj.batchUpdate = function(sql, paramsList) {
			var jsonParams = JSON.stringify((paramsList || []).map(function(row) {
				return row.map(convertDateValues);
			}));
			return Q.nfcall(thisConn.batchUpdate, sql, jsonParams).then(res => Array.from(res));			
		};
		obj.insertAndGetId = function(sql, params) {			
			var jsonParams = paramsToJson(params || []);
			return Q.nfcall(thisConn.insertAndGetId, sql, jsonParams);
		};
		obj.insertList = function(tableName, idColumn, list) {
			return insertListFun(obj, tableName, idColumn, list);
		};
		obj.isInMemory = function() {
			return inMemory;
		};
		return obj;
	};

	const jt400 = mixinConnection({
		transaction: function(transactionFunction) {
			var t = connection.connection.createTransactionSync(),
				c = {
					update: t.update.bind(t),
					execute: t.execute.bind(t),
					insertAndGetId: t.insertAndGetId.bind(t),
					batchUpdate: t.batchUpdate.bind(t),
					query: t.query.bind(t)
				},
				transaction = mixinConnection({
					commit: function() {
						t.commitSync();
					},
					rollback: function() {
						t.rollbackSync();
					}
				}, c);
			return transactionFunction(transaction)
				.then(function(res) {
					t.commitSync();
					t.endSync();
					return res;
				})
				.catch(function(err) {
					t.rollbackSync();
					t.endSync();
					throw err;
				});
		},
		getTablesAsStream: function(opt) {
			return new JdbcStream({
				jdbcStream: connection.connection.getTablesAsStreamSync(opt.catalog, opt.schema, opt.table || '%')
			}).pipe(JSONStream.parse([true]));
		},
		getColumns: function(opt) {
			return Q.nfcall(connection.getColumns, opt.catalog, opt.schema, opt.table, opt.columns || '%').then(JSON.parse);
		},
		getPrimaryKeys: function(opt) {
			return Q.nfcall(connection.getPrimaryKeys, opt.catalog, opt.schema, opt.table).then(JSON.parse);
		},
		createKeyedDataQ: function(opt) {
			var dq = connection.createKeyedDataQ(opt.name),
				read = dq.read.bind(dq),
				readRes = function(key, wait, writeKeyLength) {
					return Q.nfcall(dq.readResponse.bind(dq), key, wait, writeKeyLength).then(function(res) {
						return {
							data: res.getDataSync(),
							write: res.writeSync.bind(res)
						};
					});
				};
			return {
				write: function(key, data) {
					dq.writeSync(key, data);
				},
				read: function() {
					var wait = -1, key, writeKeyLength;
					if (arguments[0] === Object(arguments[0])) {
						key = arguments[0].key;
						wait = arguments[0].wait || wait;
						writeKeyLength = arguments[0].writeKeyLength;
					} else {
						key = arguments[0];
					}
					return writeKeyLength ? readRes(key, wait, writeKeyLength) : Q.nfcall(read, key, wait);
				}
			};
		},
		openMessageFile: function (opt: MessageFileHandlerOptions) {
			var f : MessageFileHandler = connection.openMessageFile(opt.path);
			var read = f.read.bind(f);
			return { 
				read: function(){
					var messageId = arguments[0].messageId;
					return Q.nfcall(read, messageId);
				}
			};
		},
		ifs: function() {
			return createIfs(connection.connection);
		},
		pgm: function(programName, paramsSchema) {
			var pgm = connection.connection.pgmSync(programName, JSON.stringify(paramsSchema)),
				pgmFunc = pgm.run.bind(pgm);
			return function(params) {
				return Q.nfcall(pgmFunc, JSON.stringify(params)).then(JSON.parse);
			};
		},
		close: function() {
			var cl = connection.connection.close.bind(connection.connection);
			return Q.nfcall(cl);
		}
	});
	return jt400;
}

export interface WriteStreamOptions {
	bufferSize: number
}

export interface PgmParamType1 {
	name: string
	size: number
	type?: string
	decimals?: number
}

export interface PgmParamType2 {
	name: string
	precision: number
	typeName?: string
	scale?: number
}

export interface PgmParamStructType {
	[key: string]: PgmParamType[]
}

export type PgmParamType = PgmParamType1 | PgmParamType2 | PgmParamStructType

export interface CLOB {
	type: 'CLOB',
	value: string
}

export type Param = string | number | Date | null | CLOB

export interface DataQOptions {
	name: string
}

export interface DataQReadOptions {
	key: string
	wait?: number
	writeKeyLength?: number
}
export interface MessageFileHandlerOptions{
	/** Message File Location, e.g. /QSYS.LIB/YOURLIBRARY.LIB/YOURMSGFILE.MSGF */
	path: string
}
export interface MessageFileReadOptions{
	/** Message Key */
	messageId: string[7]
}

export interface KeyedDataQ {
	write: (key: string, data: string) => void
	read: (params: DataQReadOptions | string) => Promise<any>
}


export interface AS400Message {
	getText: (cb:(err:any,data:string)=>void) => void
	getTextSync: () => string
	getTextPromise: () => Promise<string>
}

export interface MessageFileHandler {
	read: (params: MessageFileReadOptions) => AS400Message
}

export interface IfsFileMetadata {
    exists: boolean
    length: number
}

export interface Ifs {
	createReadStream: (fileName: string | Promise<string>) => Readable
	createWriteStream: (fileName: string | Promise<string>, options?: { append: boolean }) => Writable
	deleteFile: (fileName: string) => Promise<boolean>
	fileMetadata: (fileName: string) => Promise<IfsFileMetadata>
}

export interface BaseConnection {
	query: <T>(sql: string, params?: Param[]) => Promise<T[]>
	update: (sql: string, params?: Param[]) => Promise<number>
	isInMemory: () => boolean
	createReadStream: (sql: string, params?: Param[]) => Readable
	insertAndGetId: (sql: string, params?: Param[]) => Promise<number>
	insertList: (tableName: string, idColumn: string, rows: any[]) => Promise<number[]>
	createWriteStream: (sql: string, options?: WriteStreamOptions) => Writable
	batchUpdate: (sql: string, params?: Param[][]) => Promise<number[]>
	execute: (sql: string, params?: Param[]) => Promise<any>

}

export type TransactionFun = (transaction: BaseConnection) => Promise<any>

export interface Connection extends BaseConnection {
	pgm: (programName: string, paramsSchema: PgmParamType[]) => any
	getTablesAsStream: (params: any) => Readable
	getColumns: (params: any) => any
	getPrimaryKeys: (params: any) => any
	transaction: (fn: TransactionFun) => Promise<any>
	createKeyedDataQ: (params: DataQOptions) => KeyedDataQ
	openMessageFile: (params: MessageFileHandlerOptions) => MessageFileHandler
	ifs: () => Ifs
}

export interface InMemoryConnection extends Connection {
	mockPgm: (programName: string, fn: (input: any) => any) => InMemoryConnection
}

export interface nodeJava {
	classpath: Array<string>,
	options: Array<string>,
	nativeBindingLocation: string,
	asyncOptions: object,
	isJvmCreated: Function,
	registerClient: Function,
	registerClientP: Function,
	ensureJvm: Function,
	onJvmCreated: Function,
	import: Function,
};

export function initialize(java?: nodeJava) {
	const jvm = java ? java : require('java');
	
	const asyncOptions = {
		asyncSuffix: "",
		syncSuffix: "Sync",
		promiseSuffix: "Promise", // Generate methods returning promises, using the suffix Promise.
		promisify: promisify
	};

	if (!jvm.asyncOptions) {
		jvm.asyncOptions = asyncOptions;
	}
	
	jvm.options.push('-Xrs'); // fixing the signal handling issues (for exmaple ctrl-c)

	jvm.classpath.push(__dirname + '/../../java/lib/jt400.jar');
	jvm.classpath.push(__dirname + '/../../java/lib/jt400wrap.jar');
	jvm.classpath.push(__dirname + '/../../java/lib/json-simple-1.1.1.jar');
	jvm.classpath.push(__dirname + '/../../java/lib/hsqldb.jar');

	process.on('exit', function(code) {
		jvm.import('java.lang.System').exit(code);
	});

	return jvm;
}

export function pool(config?, java?: nodeJava): Connection {
	const jvm = initialize(java);
	var javaCon = jvm.import('nodejt400.JT400').createPoolSync(JSON.stringify(defaults(config || {}, defaultConfig)));
	return createInstance(createConFrom(javaCon), insertListInOneStatment, false)
}

export function connect(config?, java?: nodeJava) {
	const jvm = initialize(java);
	var jt = jvm.import('nodejt400.JT400'),
		createConnection = jt.createConnection.bind(jt)
	return Q.nfcall(createConnection, JSON.stringify(defaults(config || {}, defaultConfig))).then(function(javaCon) {
		return createInstance(createConFrom(javaCon), insertListInOneStatment, false)
	})
}

export function useInMemoryDb(java?: nodeJava): InMemoryConnection {
	const jvm = initialize(java);
	var javaCon = jvm.newInstanceSync('nodejt400.HsqlClient')
	var instance = createInstance(createConFrom(javaCon), standardInsertList, true)
	var pgmMockRegistry = {}
	instance.mockPgm = function(programName, func) {
		pgmMockRegistry[programName] = func
		return instance
	}

	var defaultPgm = instance.pgm
	instance.pgm = function(programName, paramsSchema) {
		var defaultFunc = defaultPgm(programName, paramsSchema)
		return function(params) {
			var mockFunc = pgmMockRegistry[programName]
			if (mockFunc) {
				var res = mockFunc(params)
				return res.then ? res : Q.when(res)
			}
			return defaultFunc(params)
		}
	}
	return instance
}
