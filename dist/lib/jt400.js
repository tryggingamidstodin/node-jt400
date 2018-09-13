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
const defaultConfig = {
    host: process.env.AS400_HOST,
    user: process.env.AS400_USERNAME,
    password: process.env.AS400_PASSWORD,
    naming: 'system'
};
const { promisify } = require('util');
jvm.asyncOptions = {
    asyncSuffix: "",
    syncSuffix: "Sync",
    promiseSuffix: "Promise",
    promisify: promisify
};
jvm.options.push('-Xrs');
jvm.classpath.push(__dirname + '/../../java/lib/jt400.jar');
jvm.classpath.push(__dirname + '/../../java/lib/jt400wrap.jar');
jvm.classpath.push(__dirname + '/../../java/lib/json-simple-1.1.1.jar');
jvm.classpath.push(__dirname + '/../../java/lib/hsqldb.jar');
process.on('exit', function (code) {
    jvm.import('java.lang.System').exit(code);
});
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
    return Object.keys(list).map(function (k) {
        return list[k];
    });
}
function insertListInOneStatment(jt400, tableName, idColumn, list) {
    if (!list || list.length === 0) {
        return new Q([]);
    }
    var sql = 'SELECT ' + idColumn + ' FROM NEW TABLE(' + sqlutil_1.toInsertSql(tableName, list) + ')', params = list.map(values).reduce(function (arr, valueArr) {
        return arr.concat(valueArr);
    }, []);
    return jt400.query(sql, params).then(function (idList) {
        return idList.map(function (idObj) {
            return idObj[idColumn.toUpperCase()];
        });
    });
}
function standardInsertList(jt400, tableName, _, list) {
    var idList = [], pushToIdList = idList.push.bind(idList);
    return list.map(function (record) {
        return {
            sql: sqlutil_1.toInsertSql(tableName, [record]),
            values: values(record)
        };
    }).reduce(function (soFar, sqlObj) {
        return soFar.then(function () {
            return jt400.insertAndGetId(sqlObj.sql, sqlObj.values);
        })
            .then(pushToIdList);
    }, new Q())
        .then(function () { return idList; });
}
function convertDateValues(v) {
    return (v instanceof Date) ? v.toISOString().replace('T', ' ').replace('Z', '') : v;
}
function paramsToJson(params) {
    return JSON.stringify((params || []).map(convertDateValues));
}
function createInstance(connection, insertListFun, inMemory) {
    var mixinConnection = function (obj, newConn) {
        var thisConn = newConn || connection;
        obj.query = function (sql, params) {
            var jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.query, sql, jsonParams).then(JSON.parse);
        };
        obj.createReadStream = function (sql, params) {
            var jsonParams = paramsToJson(params || []);
            return new jdbcstream_1.JdbcStream({
                jdbcStreamPromise: Q.nfcall(thisConn.queryAsStream, sql, jsonParams, 100)
            });
        };
        obj.queryAsStream = obj.createReadStream;
        obj.execute = function (sql, params) {
            var jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.execute, sql, jsonParams).then(function (statement) {
                var isQuery = statement.isQuerySync(), metadata = statement.getMetaData.bind(statement), updated = statement.updated.bind(statement), stream;
                var stWrap = {
                    isQuery: function () {
                        return isQuery;
                    },
                    metadata: function () {
                        return Q.nfcall(metadata).then(JSON.parse);
                    },
                    asArray: () => Q.nfcall(statement.asArray.bind(statement)).then(JSON.parse),
                    asStream: function (options) {
                        options = options || {};
                        stream = new jdbcstream_1.JdbcStream({
                            jdbcStream: statement.asStreamSync(options.bufferSize || 100)
                        });
                        return stream;
                    },
                    updated: function () {
                        return Q.nfcall(updated);
                    },
                    close: function () {
                        if (stream) {
                            stream.close();
                        }
                        else {
                            statement.close(function (err) {
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
        obj.update = function (sql, params) {
            var jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.update, sql, jsonParams);
        };
        obj.createWriteStream = function (sql, options) {
            return jdbcwritestream_1.createJdbcWriteStream(obj.batchUpdate, sql, options && options.bufferSize);
        };
        obj.batchUpdate = function (sql, paramsList) {
            var jsonParams = JSON.stringify((paramsList || []).map(function (row) {
                return row.map(convertDateValues);
            }));
            return Q.nfcall(thisConn.batchUpdate, sql, jsonParams).then(res => Array.from(res));
        };
        obj.insertAndGetId = function (sql, params) {
            var jsonParams = paramsToJson(params || []);
            return Q.nfcall(thisConn.insertAndGetId, sql, jsonParams);
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
        transaction: function (transactionFunction) {
            var t = connection.connection.createTransactionSync(), c = {
                update: t.update.bind(t),
                execute: t.execute.bind(t),
                insertAndGetId: t.insertAndGetId.bind(t),
                batchUpdate: t.batchUpdate.bind(t),
                query: t.query.bind(t)
            }, transaction = mixinConnection({
                commit: function () {
                    t.commitSync();
                },
                rollback: function () {
                    t.rollbackSync();
                }
            }, c);
            return transactionFunction(transaction)
                .then(function (res) {
                t.commitSync();
                t.endSync();
                return res;
            })
                .catch(function (err) {
                t.rollbackSync();
                t.endSync();
                throw err;
            });
        },
        getTablesAsStream: function (opt) {
            return new jdbcstream_1.JdbcStream({
                jdbcStream: connection.connection.getTablesAsStreamSync(opt.catalog, opt.schema, opt.table || '%')
            }).pipe(JSONStream.parse([true]));
        },
        getColumns: function (opt) {
            return Q.nfcall(connection.getColumns, opt.catalog, opt.schema, opt.table, opt.columns || '%').then(JSON.parse);
        },
        getPrimaryKeys: function (opt) {
            return Q.nfcall(connection.getPrimaryKeys, opt.catalog, opt.schema, opt.table).then(JSON.parse);
        },
        openMessageQ: function (opt) {
            const hasPath = typeof opt.path === "string";
            const name = hasPath ? opt.path : opt.name;
            var dq = connection.openMessageQ(name, hasPath), read = dq.read.bind(dq), sendInformational = dq.sendInformational.bind(dq);
            return {
                read: function () {
                    var wait = -1;
                    if (arguments[0] === Object(arguments[0])) {
                        wait = arguments[0].wait || wait;
                    }
                    return Q.nfcall(read, wait);
                },
                sendInformational: function (messageText) {
                    return Q.nfcall(sendInformational, messageText);
                }
            };
        },
        createKeyedDataQ: function (opt) {
            var dq = connection.createKeyedDataQ(opt.name), read = dq.read.bind(dq), readRes = function (key, wait, writeKeyLength) {
                return Q.nfcall(dq.readResponse.bind(dq), key, wait, writeKeyLength).then(function (res) {
                    return {
                        data: res.getDataSync(),
                        write: res.writeSync.bind(res)
                    };
                });
            };
            return {
                write: function (key, data) {
                    dq.writeSync(key, data);
                },
                read: function () {
                    var wait = -1, key, writeKeyLength;
                    if (arguments[0] === Object(arguments[0])) {
                        key = arguments[0].key;
                        wait = arguments[0].wait || wait;
                        writeKeyLength = arguments[0].writeKeyLength;
                    }
                    else {
                        key = arguments[0];
                    }
                    return writeKeyLength ? readRes(key, wait, writeKeyLength) : Q.nfcall(read, key, wait);
                }
            };
        },
        openMessageFile: function (opt) {
            var f = connection.openMessageFile(opt.path);
            var read = f.read.bind(f);
            return {
                read: function () {
                    var messageId = arguments[0].messageId;
                    return Q.nfcall(read, messageId);
                }
            };
        },
        ifs: function () {
            return ifs_1.ifs(connection.connection);
        },
        pgm: function (programName, paramsSchema) {
            var pgm = connection.connection.pgmSync(programName, JSON.stringify(paramsSchema)), pgmFunc = pgm.run.bind(pgm);
            return function (params) {
                return Q.nfcall(pgmFunc, JSON.stringify(params)).then(JSON.parse);
            };
        },
        close: function () {
            var cl = connection.connection.close.bind(connection.connection);
            return Q.nfcall(cl);
        }
    });
    return jt400;
}
function pool(config) {
    var javaCon = jvm.import('nodejt400.JT400').createPoolSync(JSON.stringify(defaults_1.defaults(config || {}, defaultConfig)));
    return createInstance(createConFrom(javaCon), insertListInOneStatment, false);
}
exports.pool = pool;
function connect(config) {
    var jt = jvm.import('nodejt400.JT400'), createConnection = jt.createConnection.bind(jt);
    return Q.nfcall(createConnection, JSON.stringify(defaults_1.defaults(config || {}, defaultConfig))).then(function (javaCon) {
        return createInstance(createConFrom(javaCon), insertListInOneStatment, false);
    });
}
exports.connect = connect;
function useInMemoryDb() {
    var javaCon = jvm.newInstanceSync('nodejt400.HsqlClient');
    var instance = createInstance(createConFrom(javaCon), standardInsertList, true);
    var pgmMockRegistry = {};
    instance.mockPgm = function (programName, func) {
        pgmMockRegistry[programName] = func;
        return instance;
    };
    var defaultPgm = instance.pgm;
    instance.pgm = function (programName, paramsSchema) {
        var defaultFunc = defaultPgm(programName, paramsSchema);
        return function (params) {
            var mockFunc = pgmMockRegistry[programName];
            if (mockFunc) {
                var res = mockFunc(params);
                return res.then ? res : Q.when(res);
            }
            return defaultFunc(params);
        };
    };
    return instance;
}
exports.useInMemoryDb = useInMemoryDb;
//# sourceMappingURL=jt400.js.map