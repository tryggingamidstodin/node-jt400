import { Readable, Writable } from 'stream'
import { JdbcStream } from './jdbcstream'
import { ifs as createIfs } from './ifs'
import { toInsertSql } from './sqlutil'
import { createJdbcWriteStream } from './jdbcwritestream'
import jvm = require('java')
import JSONStream = require('JSONStream')
import { defaults } from './defaults'
import Q = require('q')
import { deprecate } from 'util'
import { Oops } from 'oops-error'

const defaultConfig = {
  host: process.env.AS400_HOST,
  user: process.env.AS400_USERNAME,
  password: process.env.AS400_PASSWORD,
  naming: 'system'
}

const { promisify } = require('util')

jvm.asyncOptions = {
  asyncSuffix: '',
  syncSuffix: 'Sync',
  promiseSuffix: 'Promise', // Generate methods returning promises, using the suffix Promise.
  promisify: promisify
}
jvm.options.push('-Xrs') // fixing the signal handling issues (for exmaple ctrl-c)
jvm.options.push('-Dcom.ibm.as400.access.AS400.guiAvailable=false') // Removes gui prompts

jvm.classpath.push(__dirname + '/../../java/lib/jt400.jar')
jvm.classpath.push(__dirname + '/../../java/lib/jt400wrap.jar')
jvm.classpath.push(__dirname + '/../../java/lib/json-simple-1.1.1.jar')
jvm.classpath.push(__dirname + '/../../java/lib/hsqldb.jar')

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
    openMessageQ: con.openMessageQSync.bind(con),
    createKeyedDataQ: con.createKeyedDataQSync.bind(con),
    openMessageFile: con.openMessageFileSync.bind(con)
  }
}

function values(list) {
  return Object.keys(list).map(k => list[k])
}

function insertListInOneStatment(jt400, tableName, idColumn, list) {
  if (!list || list.length === 0) {
    return new Q([])
  }
  const sql =
    'SELECT ' +
    idColumn +
    ' FROM NEW TABLE(' +
    toInsertSql(tableName, list) +
    ')'
  const params = list.map(values).reduce((arr, valueArr) => {
    return arr.concat(valueArr)
  }, [])

  return jt400.query(sql, params).then(idList => {
    return idList.map(idObj => idObj[idColumn.toUpperCase()])
  })
}

function handleError(context) {
  return err => {
    const errMsg =
      (err.cause && err.cause.getMessageSync && err.cause.getMessageSync()) ||
      err.message
    const category = errMsg.toLowerCase().includes('connection')
      ? 'OperationalError'
      : 'ProgrammerError'

    throw new Oops({
      message: errMsg,
      context,
      category,
      cause: err
    })
  }
}
function standardInsertList(jt400, tableName, _, list) {
  const idList = []
  const pushToIdList = idList.push.bind(idList)

  return list
    .map(record => {
      return {
        sql: toInsertSql(tableName, [record]),
        values: values(record)
      }
    })
    .reduce((soFar, sqlObj) => {
      return soFar
        .then(() => {
          return jt400.insertAndGetId(sqlObj.sql, sqlObj.values)
        })
        .then(pushToIdList)
    }, new Q())
    .then(() => {
      return idList
    })
}

function convertDateValues(v) {
  return v instanceof Date
    ? v
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '')
    : v
}

function paramsToJson(params) {
  return JSON.stringify((params || []).map(convertDateValues))
}

function createInstance(connection, insertListFun, inMemory) {
  const mixinConnection = function(obj, newConn?) {
    const thisConn = newConn || connection

    obj.query = function(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return Q.nfcall(thisConn.query, sql, jsonParams)
        .then(JSON.parse)
        .catch(handleError({ sql, params }))
    }

    obj.createReadStream = function(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return new JdbcStream({
        jdbcStreamPromise: Q.nfcall(
          thisConn.queryAsStream,
          sql,
          jsonParams,
          100
        ).catch(handleError({ sql, params }))
      })
    }

    obj.queryAsStream = obj.createReadStream

    obj.execute = function(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return Q.nfcall(thisConn.execute, sql, jsonParams)
        .then(statement => {
          const isQuery = statement.isQuerySync()
          const metadata = statement.getMetaData.bind(statement)
          const updated = statement.updated.bind(statement)
          let stream
          const stWrap = {
            isQuery() {
              return isQuery
            },
            metadata() {
              return Q.nfcall(metadata).then(JSON.parse)
            },
            asArray() {
              return Q.nfcall(statement.asArray.bind(statement)).then(
                JSON.parse
              )
            },
            asStream(options) {
              options = options || {}
              stream = new JdbcStream({
                jdbcStream: statement.asStreamSync(options.bufferSize || 100)
              })
              return stream
            },
            updated() {
              return Q.nfcall(updated)
            },
            close() {
              if (stream) {
                stream.close()
              } else {
                statement.close(err => {
                  if (err) {
                    console.log('close error', err)
                  }
                })
              }
            }
          }
          return stWrap
        })
        .catch(handleError({ sql, params }))
    }
    obj.update = function(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return Q.nfcall(thisConn.update, sql, jsonParams).catch(
        handleError({ sql, params })
      )
    }

    obj.createWriteStream = function(sql, options) {
      return createJdbcWriteStream(
        obj.batchUpdate,
        sql,
        options && options.bufferSize
      )
    }

    obj.batchUpdate = function(sql, paramsList) {
      const params = (paramsList || []).map(row => {
        return row.map(convertDateValues)
      })

      const jsonParams = JSON.stringify(params)
      return Q.nfcall(thisConn.batchUpdate, sql, jsonParams)
        .then(res => Array.from(res))
        .catch(handleError({ sql, params }))
    }

    obj.insertAndGetId = function(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return Q.nfcall(thisConn.insertAndGetId, sql, jsonParams).catch(
        handleError({ sql, params })
      )
    }

    obj.insertList = function(tableName, idColumn, list) {
      return insertListFun(obj, tableName, idColumn, list)
    }

    obj.isInMemory = function() {
      return inMemory
    }
    return obj
  }

  const jt400 = mixinConnection({
    transaction(transactionFunction) {
      const t = connection.connection.createTransactionSync()
      const c = {
        update: t.update.bind(t),
        execute: t.execute.bind(t),
        insertAndGetId: t.insertAndGetId.bind(t),
        batchUpdate: t.batchUpdate.bind(t),
        query: t.query.bind(t)
      }
      const transaction = mixinConnection(
        {
          commit() {
            t.commitSync()
          },
          rollback() {
            t.rollbackSync()
          }
        },
        c
      )

      return transactionFunction(transaction)
        .then(res => {
          t.commitSync()
          t.endSync()
          return res
        })
        .catch(err => {
          t.rollbackSync()
          t.endSync()
          throw err
        })
    },
    getTablesAsStream(opt) {
      return new JdbcStream({
        jdbcStream: connection.connection.getTablesAsStreamSync(
          opt.catalog,
          opt.schema,
          opt.table || '%'
        )
      }).pipe(JSONStream.parse([true]))
    },
    getColumns(opt) {
      return Q.nfcall(
        connection.getColumns,
        opt.catalog,
        opt.schema,
        opt.table,
        opt.columns || '%'
      ).then(JSON.parse)
    },
    getPrimaryKeys(opt) {
      return Q.nfcall(
        connection.getPrimaryKeys,
        opt.catalog,
        opt.schema,
        opt.table
      ).then(JSON.parse)
    },
    openMessageQ(opt) {
      const hasPath = typeof opt.path === 'string'
      const name = hasPath ? opt.path : opt.name
      const dq = connection.openMessageQ(name, hasPath)
      const read = dq.read.bind(dq)
      const sendInformational = dq.sendInformational.bind(dq)
      return {
        // write (key, data) {
        // 	dq.writeSync(key, data);
        // },
        read() {
          let wait = -1
          if (arguments[0] === Object(arguments[0])) {
            wait = arguments[0].wait || wait
          }
          return Q.nfcall(read, wait)
        },
        sendInformational(messageText) {
          return Q.nfcall(sendInformational, messageText)
        }
      }
    },
    createKeyedDataQ(opt) {
      const dq = connection.createKeyedDataQ(opt.name)
      const read = dq.read.bind(dq)
      const readRes = function(key, wait, writeKeyLength) {
        return Q.nfcall(
          dq.readResponse.bind(dq),
          key,
          wait,
          writeKeyLength
        ).then(res => {
          return {
            data: res.getDataSync(),
            write: res.writeSync.bind(res)
          }
        })
      }
      return {
        write(key, data) {
          dq.writeSync(key, data)
        },
        read() {
          let wait = -1
          let key
          let writeKeyLength
          if (arguments[0] === Object(arguments[0])) {
            key = arguments[0].key
            wait = arguments[0].wait || wait
            writeKeyLength = arguments[0].writeKeyLength
          } else {
            key = arguments[0]
          }
          return writeKeyLength
            ? readRes(key, wait, writeKeyLength)
            : Q.nfcall(read, key, wait)
        }
      }
    },
    openMessageFile(opt: MessageFileHandlerOptions) {
      const f: MessageFileHandler = connection.openMessageFile(opt.path)
      const read = f.read.bind(f)
      return {
        read() {
          const messageId = arguments[0].messageId
          return Q.nfcall(read, messageId)
        }
      }
    },
    ifs() {
      return createIfs(connection.connection)
    },
    defineProgram(opt: ProgramDefinitionOptions) {
      const pgm = connection.connection.pgmSync(
        opt.programName,
        JSON.stringify(opt.paramsSchema),
        opt.libraryName || '*LIBL',
        opt.ccsid
      )
      const pgmFunc = pgm.run.bind(pgm)
      return function run(params, timeout = 3) {
        return Q.nfcall(pgmFunc, JSON.stringify(params), timeout).then(
          JSON.parse
        )
      }
    },
    pgm: deprecate(function(programName, paramsSchema, libraryName) {
      return this.defineProgram({
        programName,
        paramsSchema,
        libraryName
      })
    }, 'pgm function is deprecated and will be removed in version 5.0. Please use defineProgram.'),
    close() {
      const cl = connection.connection.close.bind(connection.connection)
      return Q.nfcall(cl)
    }
  })

  return jt400
}

export interface ProgramDefinitionOptions {
  programName: string
  paramsSchema: PgmParamType[]
  libraryName?: string
  ccsid?: number
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
  type: 'CLOB'
  value: string
}

export type Param = string | number | Date | null | CLOB

export interface JustNameMessageQ {
  name: string
}
export interface JustPathMessageQ {
  path: string
}
export type MessageQOptions = JustNameMessageQ | JustPathMessageQ

export interface MessageQReadOptions {
  wait?: number
}

export interface DataQReadOptions {
  key: string
  wait?: number
  writeKeyLength?: number
}
export interface MessageFileHandlerOptions {
  /** Message File Location, e.g. /QSYS.LIB/YOURLIBRARY.LIB/YOURMSGFILE.MSGF */
  path: string
}
export interface MessageFileReadOptions {
  /** Message Key */
  messageId: string[7]
}

export interface MessageQ {
  sendInformational: (messageText: string) => Promise<void>
  read: (params?: MessageQReadOptions) => Promise<any> | Promise<null>
}

export interface DataQOptions {
  name: string
}
export interface KeyedDataQ {
  write: (key: string, data: string) => void
  read: (params: DataQReadOptions | string) => Promise<any>
}

export interface AS400Message {
  getText: (cb: (err: any, data: string) => void) => void
  getTextSync: () => string
  getTextPromise: () => Promise<string>
}

export interface MessageFileHandler {
  read: (params: MessageFileReadOptions) => Promise<AS400Message>
}

export interface IfsFileMetadata {
  exists: boolean
  length: number
}

export interface Ifs {
  createReadStream: (fileName: string | Promise<string>) => Readable
  createWriteStream: (
    fileName: string | Promise<string>,
    options?: { append: boolean; ccsid?: number }
  ) => Writable
  deleteFile: (fileName: string) => Promise<boolean>
  fileMetadata: (fileName: string) => Promise<IfsFileMetadata>
}

export interface BaseConnection {
  query: <T>(sql: string, params?: Param[]) => Promise<T[]>
  update: (sql: string, params?: Param[]) => Promise<number>
  isInMemory: () => boolean
  createReadStream: (sql: string, params?: Param[]) => Readable
  insertAndGetId: (sql: string, params?: Param[]) => Promise<number>
  insertList: (
    tableName: string,
    idColumn: string,
    rows: any[]
  ) => Promise<number[]>
  createWriteStream: (sql: string, options?: WriteStreamOptions) => Writable
  batchUpdate: (sql: string, params?: Param[][]) => Promise<number[]>
  execute: (sql: string, params?: Param[]) => Promise<any>
}

export type TransactionFun = (transaction: BaseConnection) => Promise<any>

export interface Connection extends BaseConnection {
  pgm: (
    programName: string,
    paramsSchema: PgmParamType[],
    libraryName?: string
  ) => any
  defineProgram: (options: ProgramDefinitionOptions) => any
  getTablesAsStream: (params: any) => Readable
  getColumns: (params: any) => any
  getPrimaryKeys: (params: any) => any
  transaction: (fn: TransactionFun) => Promise<any>
  openMessageQ: (params: MessageQOptions) => Promise<MessageQ>
  createKeyedDataQ: (params: DataQOptions) => KeyedDataQ
  openMessageFile: (
    params: MessageFileHandlerOptions
  ) => Promise<MessageFileHandler>
  ifs: () => Ifs
}

export interface InMemoryConnection extends Connection {
  mockPgm: (programName: string, fn: (input: any) => any) => InMemoryConnection
}

export function pool(config?): Connection {
  const javaCon = jvm
    .import('nodejt400.JT400')
    .createPoolSync(JSON.stringify(defaults(config || {}, defaultConfig)))
  return createInstance(createConFrom(javaCon), insertListInOneStatment, false)
}
export function connect(config?) {
  const jt = jvm.import('nodejt400.JT400')
  const createConnection = jt.createConnection.bind(jt)
  return Q.nfcall(
    createConnection,
    JSON.stringify(defaults(config || {}, defaultConfig))
  ).then(javaCon => {
    return createInstance(
      createConFrom(javaCon),
      insertListInOneStatment,
      false
    )
  })
}

export function useInMemoryDb(): InMemoryConnection {
  const javaCon = jvm.newInstanceSync('nodejt400.HsqlClient')
  const instance = createInstance(
    createConFrom(javaCon),
    standardInsertList,
    true
  )
  const pgmMockRegistry = {}
  instance.mockPgm = function(programName, func) {
    pgmMockRegistry[programName] = func
    return instance
  }

  const defaultPgm = instance.defineProgram
  instance.defineProgram = function(opt) {
    const defaultFunc = defaultPgm(opt.programName, opt.paramsSchema)
    return function(params, timeout = 3) {
      const mockFunc = pgmMockRegistry[opt.programName]

      if (mockFunc) {
        const res = mockFunc(params, timeout)
        return res.then ? res : Q.when(res)
      }

      return defaultFunc(params, timeout)
    }
  }
  return instance
}
