"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jdbcstream_1 = require("./jdbcstream");
const ifs_1 = require("./ifs");
const sqlutil_1 = require("./sqlutil");
const jdbcwritestream_1 = require("./jdbcwritestream");
const jvm = require("java");
const JSONStream = require("JSONStream");
const defaults_1 = require("./defaults");
const Q = require("q");
const util_1 = require("util");
const oops_error_1 = require("oops-error");
const defaultConfig = {
    host: process.env.AS400_HOST,
    user: process.env.AS400_USERNAME,
    password: process.env.AS400_PASSWORD,
    naming: 'system'
};
const { promisify } = require('util');
jvm.asyncOptions = {
    asyncSuffix: '',
    syncSuffix: 'Sync',
    promiseSuffix: 'Promise',
    promisify: promisify
};
jvm.options.push('-Xrs');
jvm.options.push('-Dcom.ibm.as400.access.AS400.guiAvailable=false');
jvm.classpath.push(__dirname + '/../../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../../java/lib/json-simple-1.1.1.jar');
jvm.classpath.push(__dirname + '/../../java/lib/hsqldb.jar');
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
        openMessageQ: con.openMessageQSync.bind(con),
        createKeyedDataQ: con.createKeyedDataQSync.bind(con),
        openMessageFile: con.openMessageFileSync.bind(con)
    };
}
function values(list) {
    return Object.keys(list).map(k => list[k]);
}
function insertListInOneStatment(jt400, tableName, idColumn, list) {
    if (!list || list.length === 0) {
        return new Q([]);
    }
    const sql = 'SELECT ' +
        idColumn +
        ' FROM NEW TABLE(' +
        sqlutil_1.toInsertSql(tableName, list) +
        ')';
    const params = list.map(values).reduce((arr, valueArr) => {
        return arr.concat(valueArr);
    }, []);
    return jt400.query(sql, params).then(idList => {
        return idList.map(idObj => idObj[idColumn.toUpperCase()]);
    });
}
function handleError(context) {
    return err => {
        const errMsg = (err.cause && err.cause.getMessageSync && err.cause.getMessageSync()) ||
            err.message;
        const category = errMsg.toLowerCase().includes('connection')
            ? 'OperationalError'
            : 'ProgrammerError';
        throw new oops_error_1.Oops({
            message: errMsg,
            context,
            category,
            cause: err
        });
    };
}
function standardInsertList(jt400, tableName, _, list) {
    const idList = [];
    const pushToIdList = idList.push.bind(idList);
    return list
        .map(record => {
        return {
            sql: sqlutil_1.toInsertSql(tableName, [record]),
            values: values(record)
        };
    })
        .reduce((soFar, sqlObj) => {
        return soFar
            .then(() => {
            return jt400.insertAndGetId(sqlObj.sql, sqlObj.values);
        })
            .then(pushToIdList);
    }, new Q())
        .then(() => {
        return idList;
    });
}
function convertDateValues(v) {
    return v instanceof Date
        ? v
            .toISOString()
            .replace('T', ' ')
            .replace('Z', '')
        : v;
}
function paramsToJson(params) {
    return JSON.stringify((params || []).map(convertDateValues));
}
function createInstance(connection, insertListFun, inMemory) {
    const mixinConnection = function (obj, newConn) {
        const thisConn = newConn || connection;
        obj.query = function (sql, params) {
            const jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.query, sql, jsonParams)
                .then(JSON.parse)
                .catch(handleError({ sql, params }));
        };
        obj.createReadStream = function (sql, params) {
            const jsonParams = paramsToJson(params || []);
            return new jdbcstream_1.JdbcStream({
                jdbcStreamPromise: Q.nfcall(thisConn.queryAsStream, sql, jsonParams, 100).catch(handleError({ sql, params }))
            });
        };
        obj.queryAsStream = obj.createReadStream;
        obj.execute = function (sql, params) {
            const jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.execute, sql, jsonParams)
                .then(statement => {
                const isQuery = statement.isQuerySync();
                const metadata = statement.getMetaData.bind(statement);
                const updated = statement.updated.bind(statement);
                let stream;
                const stWrap = {
                    isQuery() {
                        return isQuery;
                    },
                    metadata() {
                        return Q.nfcall(metadata).then(JSON.parse);
                    },
                    asArray() {
                        return Q.nfcall(statement.asArray.bind(statement)).then(JSON.parse);
                    },
                    asStream(options) {
                        options = options || {};
                        stream = new jdbcstream_1.JdbcStream({
                            jdbcStream: statement.asStreamSync(options.bufferSize || 100)
                        });
                        return stream;
                    },
                    updated() {
                        return Q.nfcall(updated);
                    },
                    close() {
                        if (stream) {
                            stream.close();
                        }
                        else {
                            statement.close(err => {
                                if (err) {
                                    console.log('close error', err);
                                }
                            });
                        }
                    }
                };
                return stWrap;
            })
                .catch(handleError({ sql, params }));
        };
        obj.update = function (sql, params) {
            const jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.update, sql, jsonParams).catch(handleError({ sql, params }));
        };
        obj.createWriteStream = function (sql, options) {
            return jdbcwritestream_1.createJdbcWriteStream(obj.batchUpdate, sql, options && options.bufferSize);
        };
        obj.batchUpdate = function (sql, paramsList) {
            const params = (paramsList || []).map(row => {
                return row.map(convertDateValues);
            });
            const jsonParams = JSON.stringify(params);
            return Q.nfcall(thisConn.batchUpdate, sql, jsonParams)
                .then(res => Array.from(res))
                .catch(handleError({ sql, params }));
        };
        obj.insertAndGetId = function (sql, params) {
            const jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.insertAndGetId, sql, jsonParams).catch(handleError({ sql, params }));
        };
        obj.insertList = function (tableName, idColumn, list) {
            return insertListFun(obj, tableName, idColumn, list);
        };
        obj.isInMemory = function () {
            return inMemory;
        };
        return obj;
    };
    const jt400 = mixinConnection({
        transaction(transactionFunction) {
            const t = connection.connection.createTransactionSync();
            const c = {
                update: t.update.bind(t),
                execute: t.execute.bind(t),
                insertAndGetId: t.insertAndGetId.bind(t),
                batchUpdate: t.batchUpdate.bind(t),
                query: t.query.bind(t)
            };
            const transaction = mixinConnection({
                commit() {
                    t.commitSync();
                },
                rollback() {
                    t.rollbackSync();
                }
            }, c);
            return transactionFunction(transaction)
                .then(res => {
                t.commitSync();
                t.endSync();
                return res;
            })
                .catch(err => {
                t.rollbackSync();
                t.endSync();
                throw err;
            });
        },
        getTablesAsStream(opt) {
            return new jdbcstream_1.JdbcStream({
                jdbcStream: connection.connection.getTablesAsStreamSync(opt.catalog, opt.schema, opt.table || '%')
            }).pipe(JSONStream.parse([true]));
        },
        getColumns(opt) {
            return Q.nfcall(connection.getColumns, opt.catalog, opt.schema, opt.table, opt.columns || '%').then(JSON.parse);
        },
        getPrimaryKeys(opt) {
            return Q.nfcall(connection.getPrimaryKeys, opt.catalog, opt.schema, opt.table).then(JSON.parse);
        },
        openMessageQ(opt) {
            const hasPath = typeof opt.path === 'string';
            const name = hasPath ? opt.path : opt.name;
            const dq = connection.openMessageQ(name, hasPath);
            const read = dq.read.bind(dq);
            const sendInformational = dq.sendInformational.bind(dq);
            return {
                read() {
                    let wait = -1;
                    if (arguments[0] === Object(arguments[0])) {
                        wait = arguments[0].wait || wait;
                    }
                    return Q.nfcall(read, wait);
                },
                sendInformational(messageText) {
                    return Q.nfcall(sendInformational, messageText);
                }
            };
        },
        createKeyedDataQ(opt) {
            const dq = connection.createKeyedDataQ(opt.name);
            const read = dq.read.bind(dq);
            const readRes = function (key, wait, writeKeyLength) {
                return Q.nfcall(dq.readResponse.bind(dq), key, wait, writeKeyLength).then(res => {
                    return {
                        data: res.getDataSync(),
                        write: res.writeSync.bind(res)
                    };
                });
            };
            return {
                write(key, data) {
                    dq.writeSync(key, data);
                },
                read() {
                    let wait = -1;
                    let key;
                    let writeKeyLength;
                    if (arguments[0] === Object(arguments[0])) {
                        key = arguments[0].key;
                        wait = arguments[0].wait || wait;
                        writeKeyLength = arguments[0].writeKeyLength;
                    }
                    else {
                        key = arguments[0];
                    }
                    return writeKeyLength
                        ? readRes(key, wait, writeKeyLength)
                        : Q.nfcall(read, key, wait);
                }
            };
        },
        openMessageFile(opt) {
            const f = connection.openMessageFile(opt.path);
            const read = f.read.bind(f);
            return {
                read() {
                    const messageId = arguments[0].messageId;
                    return Q.nfcall(read, messageId);
                }
            };
        },
        ifs() {
            return ifs_1.ifs(connection.connection);
        },
        defineProgram(opt) {
            const pgm = connection.connection.pgmSync(opt.programName, JSON.stringify(opt.paramsSchema), opt.libraryName || '*LIBL', opt.ccsid);
            const pgmFunc = pgm.run.bind(pgm);
            return function run(params, timeout = 3) {
                return Q.nfcall(pgmFunc, JSON.stringify(params), timeout).then(JSON.parse);
            };
        },
        pgm: util_1.deprecate(function (programName, paramsSchema, libraryName) {
            return this.defineProgram({
                programName,
                paramsSchema,
                libraryName
            });
        }, 'pgm function is deprecated and will be removed in version 5.0. Please use defineProgram.'),
        close() {
            const cl = connection.connection.close.bind(connection.connection);
            return Q.nfcall(cl);
        }
    });
    return jt400;
}
function pool(config) {
    const javaCon = jvm
        .import('nodejt400.JT400')
        .createPoolSync(JSON.stringify(defaults_1.defaults(config || {}, defaultConfig)));
    return createInstance(createConFrom(javaCon), insertListInOneStatment, false);
}
exports.pool = pool;
function connect(config) {
    const jt = jvm.import('nodejt400.JT400');
    const createConnection = jt.createConnection.bind(jt);
    return Q.nfcall(createConnection, JSON.stringify(defaults_1.defaults(config || {}, defaultConfig))).then(javaCon => {
        return createInstance(createConFrom(javaCon), insertListInOneStatment, false);
    });
}
exports.connect = connect;
function useInMemoryDb() {
    const javaCon = jvm.newInstanceSync('nodejt400.HsqlClient');
    const instance = createInstance(createConFrom(javaCon), standardInsertList, true);
    const pgmMockRegistry = {};
    instance.mockPgm = function (programName, func) {
        pgmMockRegistry[programName] = func;
        return instance;
    };
    const defaultPgm = instance.defineProgram;
    instance.defineProgram = function (opt) {
        const defaultFunc = defaultPgm(opt.programName, opt.paramsSchema);
        return function (params, timeout = 3) {
            const mockFunc = pgmMockRegistry[opt.programName];
            if (mockFunc) {
                const res = mockFunc(params, timeout);
                return res.then ? res : Q.when(res);
            }
            return defaultFunc(params, timeout);
        };
    };
    return instance;
}
exports.useInMemoryDb = useInMemoryDb;
//# sourceMappingURL=jt400.js.map