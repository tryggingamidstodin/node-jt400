import { initJT400Factory } from './java'
import { Readable, Writable } from 'stream'
import { JdbcStream } from './jdbcstream'
import { ifs as createIfs } from './ifs'
import { toInsertSql } from './sqlutil'
import { createJdbcWriteStream } from './jdbcwritestream'
import JSONStream = require('JSONStream')
import { deprecate } from 'util'
import { Oops } from 'oops-error'
import { JDBCConnection, JT400 } from './java/JT400'

const defaultConfig = {
  host: process.env.AS400_HOST,
  user: process.env.AS400_USERNAME,
  password: process.env.AS400_PASSWORD,
  naming: 'system',
}

const jt400Factory = initJT400Factory()

function insertListInOneStatment(jt400, tableName, idColumn, list) {
  if (!list || list.length === 0) {
    return Promise.resolve([])
  }
  const sql =
    'SELECT ' +
    idColumn +
    ' FROM NEW TABLE(' +
    toInsertSql(tableName, list) +
    ')'
  const params = list.map(Object.values).reduce((arr, valueArr) => {
    return arr.concat(valueArr)
  }, [])

  return jt400.query(sql, params).then((idList) => {
    return idList.map((idObj) => idObj[idColumn.toUpperCase()])
  })
}

function handleError(context) {
  return (err) => {
    const errMsg =
      (err.cause && err.cause.getMessageSync && err.cause.getMessageSync()) ||
      (err.getMessageSync && err.getMessageSync()) ||
      err.message
    const start = errMsg.indexOf(': ')
    const end = errMsg.indexOf('\n')
    const message = start > 0 && end > 0 ? errMsg.slice(start + 2, end) : errMsg
    const category =
      message.toLowerCase().includes('connection') ||
      errMsg.includes('java.net.UnknownHostException')
        ? 'OperationalError'
        : 'ProgrammerError'
    throw new Oops({
      message,
      context,
      category,
      cause: err,
    })
  }
}
function standardInsertList(jt400, tableName, _, list) {
  const idList = []
  const pushToIdList = idList.push.bind(idList)

  return list
    .map((record) => {
      return {
        sql: toInsertSql(tableName, [record]),
        values: Object.values(record),
      }
    })
    .reduce((soFar, sqlObj) => {
      return soFar
        .then(() => {
          return jt400.insertAndGetId(sqlObj.sql, sqlObj.values)
        })
        .then(pushToIdList)
    }, Promise.resolve())
    .then(() => {
      return idList
    })
}

function convertDateValues(v) {
  return v instanceof Date
    ? v.toISOString().replace('T', ' ').replace('Z', '')
    : v
}

function paramsToJson(params) {
  return JSON.stringify((params || []).map(convertDateValues))
}

const createBaseConnection = function (
  jdbcConnection: JDBCConnection,
  insertListFun,
  inMemory
): BaseConnection {
  const obj: BaseConnection = {
    query(sql, params, options) {
      const jsonParams = paramsToJson(params || [])

      // Sending default options to java
      const trim = options && options.trim !== undefined ? options.trim : true

      return jdbcConnection
        .query(sql, jsonParams, trim)
        .then(JSON.parse)
        .catch(handleError({ sql, params }))
    },

    createReadStream(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return new JdbcStream({
        jdbcStreamPromise: jdbcConnection
          .queryAsStream(sql, jsonParams, 100)
          .catch(handleError({ sql, params })),
      })
    },

    execute(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return jdbcConnection
        .execute(sql, jsonParams)
        .then((statement) => {
          const isQuery = statement.isQuerySync()
          let stream
          const stWrap = {
            isQuery() {
              return isQuery
            },
            metadata() {
              return statement.getMetaData().then(JSON.parse)
            },
            asArray() {
              return statement.asArray().then(JSON.parse)
            },
            asStream(options) {
              options = options || {}
              stream = new JdbcStream({
                jdbcStream: statement.asStreamSync(options.bufferSize || 100),
              })
              return stream
            },
            asIterable() {
              return {
                [Symbol.asyncIterator]() {
                  return {
                    async next() {
                      return statement
                        .next()
                        .then(JSON.parse)
                        .then((value) => ({
                          done: !Boolean(value),
                          value,
                        }))
                    },
                  }
                },
              }
            },
            updated() {
              return statement.updated()
            },
            close() {
              if (stream) {
                stream.close()
              } else {
                return statement.close()
              }
            },
          }
          return stWrap
        })
        .catch(handleError({ sql, params }))
    },
    update(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return jdbcConnection
        .update(sql, jsonParams)
        .catch(handleError({ sql, params }))
    },

    createWriteStream(sql, options) {
      return createJdbcWriteStream(
        obj.batchUpdate,
        sql,
        options && options.bufferSize
      )
    },

    batchUpdate(sql, paramsList) {
      const params = (paramsList || []).map((row) => {
        return row.map(convertDateValues)
      })

      const jsonParams = JSON.stringify(params)
      return jdbcConnection
        .batchUpdate(sql, jsonParams)
        .then((res) => Array.from(res))
        .catch(handleError({ sql, params }))
    },

    insertAndGetId(sql, params) {
      const jsonParams = paramsToJson(params || [])
      return jdbcConnection
        .insertAndGetId(sql, jsonParams)
        .catch(handleError({ sql, params }))
    },

    insertList(tableName, idColumn, list) {
      return insertListFun(obj, tableName, idColumn, list)
    },

    isInMemory() {
      return inMemory
    },
  }
  return obj
}

const isJustNameMessageQ = function (
  opt: MessageQOptions
): opt is JustNameMessageQ {
  return (opt as JustNameMessageQ).name !== undefined
}

function createInstance(connection: JT400, insertListFun, inMemory) {
  const baseConnection = createBaseConnection(
    connection,
    insertListFun,
    inMemory
  )
  const jt400: Connection = {
    ...baseConnection,
    transaction(transactionFunction) {
      const t = connection.createTransactionSync()
      const transactionContext = createBaseConnection(
        t,
        insertListFun,
        inMemory
      )

      return transactionFunction(transactionContext)
        .then((res) => {
          t.commitSync()
          t.endSync()
          return res
        })
        .catch((err) => {
          t.rollbackSync()
          t.endSync()
          throw err
        })
    },
    getTablesAsStream(opt) {
      return new JdbcStream({
        jdbcStream: connection.getTablesAsStreamSync(
          opt.catalog,
          opt.schema,
          opt.table || '%'
        ),
      }).pipe(JSONStream.parse([true]))
    },
    getColumns(opt) {
      return connection
        .getColumns(opt.catalog, opt.schema, opt.table, opt.columns || '%')
        .then(JSON.parse)
    },
    getPrimaryKeys(opt) {
      return connection
        .getPrimaryKeys(opt.catalog, opt.schema, opt.table)
        .then(JSON.parse)
    },
    async openMessageQ(opt) {
      const hasPath = !isJustNameMessageQ(opt)
      const name = isJustNameMessageQ(opt) ? opt.name : opt.path
      const dq = await connection.openMessageQ(name, hasPath)
      return {
        // write (key, data) {
        // 	dq.writeSync(key, data);
        // },
        read() {
          let wait = -1
          if (arguments[0] === Object(arguments[0])) {
            wait = arguments[0].wait || wait
          }
          return dq.read(wait)
        },
        sendInformational(messageText) {
          return dq.sendInformational(messageText)
        },
      }
    },
    createKeyedDataQ(opt) {
      const dq = connection.createKeyedDataQSync(opt.name)
      const readRes = async function (key, wait, writeKeyLength) {
        const res = await dq.readResponse(key, wait, writeKeyLength)
        const data = await res.getData()
        return {
          data,
          write: (data: string) => res.write(data),
        }
      }
      return {
        write(key, data) {
          return dq.write(key, data)
        },
        read() {
          let wait = -1
          let key: string
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
            : dq.read(key, wait)
        },
      }
    },
    async openMessageFile(opt: MessageFileHandlerOptions) {
      const messageFile = await connection.openMessageFile(opt.path)
      return {
        read() {
          const messageId = arguments[0].messageId
          return messageFile.read(messageId)
        },
      }
    },
    ifs() {
      return createIfs(connection)
    },
    defineProgram(opt: ProgramDefinitionOptions) {
      const pgm = connection.pgmSync(
        opt.programName,
        JSON.stringify(opt.paramsSchema),
        opt.libraryName || '*LIBL',
        opt.ccsid
      )
      return function run(params, timeout = 3) {
        return pgm
          .run(JSON.stringify(params), timeout)
          .then(JSON.parse)
          .catch(handleError({ programName: opt.programName, params, timeout }))
      }
    },
    pgm: deprecate(function (programName, paramsSchema, libraryName) {
      return this.defineProgram({
        programName,
        paramsSchema,
        libraryName,
      })
    }, 'pgm function is deprecated and will be removed in version 5.0. Please use defineProgram.'),
    close() {
      return connection.close()
    },
  }

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

export interface BLOB {
  type: 'BLOB'
  value: string
}

export type Param = string | number | Date | null | CLOB | BLOB

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
  getText: () => Promise<string>
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

export interface QueryOptions {
  trim: boolean
}

export interface Metadata {
  name: string
  typeName: string
  precision: number
  scale: number
}
export interface Statement {
  isQuery: () => boolean
  metadata: () => Promise<Metadata[]>
  asArray: () => Promise<string[][]>
  asIterable: () => AsyncIterable<string[]>
  asStream: (options?: any) => Readable
  updated: () => Promise<number>
  close: Close
}
export type Execute = (sql: string, params?: Param[]) => Promise<Statement>
export type Query = <T>(
  sql: string,
  params?: Param[],
  options?: QueryOptions
) => Promise<T[]>
export type Update = (sql: string, params?: Param[]) => Promise<number>
export type CreateReadStream = (sql: string, params?: Param[]) => Readable
export type InsertAndGetId = (sql: string, params?: Param[]) => Promise<number>
export type CreateWriteStream = (
  sql: string,
  options?: WriteStreamOptions
) => Writable
export type BatchUpdate = (sql: string, params?: Param[][]) => Promise<number[]>
export type Close = () => void
export type InsertList = (
  tableName: string,
  idColumn: string,
  rows: any[]
) => Promise<number[]>
export interface BaseConnection {
  query: Query
  update: Update
  isInMemory: () => boolean
  createReadStream: CreateReadStream
  insertAndGetId: InsertAndGetId
  insertList: InsertList
  createWriteStream: CreateWriteStream
  batchUpdate: (sql: string, params?: Param[][]) => Promise<number[]>
  execute: Execute
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
  close: Close
}

export interface InMemoryConnection extends Connection {
  mockPgm: (programName: string, fn: (input: any) => any) => InMemoryConnection
}

export function pool(config = {}): Connection {
  const javaCon = jt400Factory.createPool(
    JSON.stringify({ ...defaultConfig, ...config })
  )
  return createInstance(javaCon, insertListInOneStatment, false)
}
export async function connect(config = {}) {
  const javaCon = await jt400Factory.createConnection(
    JSON.stringify({
      ...defaultConfig,
      ...config,
    })
  )
  return createInstance(javaCon, insertListInOneStatment, false)
}

export function useInMemoryDb(): InMemoryConnection {
  const javaCon = jt400Factory.createInMemoryConnection()
  const instance = createInstance(javaCon, standardInsertList, true)
  const pgmMockRegistry = {}

  const defaultPgm = instance.defineProgram
  instance.defineProgram = function (opt) {
    const defaultFunc = defaultPgm(opt)
    return function (params, timeout = 3) {
      const mockFunc = pgmMockRegistry[opt.programName]

      if (mockFunc) {
        const res = mockFunc(params, timeout)
        return res.then ? res : Promise.resolve(res)
      }

      return defaultFunc(params, timeout)
    }
  }
  const inMemoryconnection: InMemoryConnection = {
    ...instance,
    mockPgm(programName, func) {
      pgmMockRegistry[programName] = func
      return inMemoryconnection
    },
  }
  return inMemoryconnection
}
