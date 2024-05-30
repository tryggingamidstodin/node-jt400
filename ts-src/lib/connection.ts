import { deprecate } from 'util'
import { BufferToJavaType, JavaTypeToBuffer } from '../java'
import { JT400 } from '../java/JT400'
import { createBaseConnection } from './baseConnection'
import {
  Connection,
  JustNameMessageQ,
  MessageFileHandlerOptions,
  MessageQOptions,
  ProgramDefinitionOptions,
} from './connection.types'
import { handleError } from './handleError'
import { ifs as createIfs } from './ifs'
import { CreateInsertList } from './insertList'
import { JdbcStream } from './jdbcstream'
import JSONStream = require('JSONStream')

const isJustNameMessageQ = function (
  opt: MessageQOptions
): opt is JustNameMessageQ {
  return (opt as JustNameMessageQ).name !== undefined
}

export function createConnection({
  connection,
  insertListFun,
  bufferToJavaType,
  javaTypeToBuffer,
  inMemory,
}: {
  connection: JT400
  insertListFun: CreateInsertList
  bufferToJavaType: BufferToJavaType
  javaTypeToBuffer: JavaTypeToBuffer
  inMemory: boolean
}): Connection {
  const baseConnection = createBaseConnection(
    connection,
    insertListFun,
    inMemory
  )
  const jt400: Connection = {
    ...baseConnection,
    async transaction(transactionFunction) {
      const t = connection.createTransactionSync()
      const transactionContext = createBaseConnection(
        t,
        insertListFun,
        inMemory
      )

      try {
        const res = await transactionFunction(transactionContext)
        await t.commit()
        return res
      } catch (err) {
        await t.rollback()
        throw err
      } finally {
        await t.end()
      }
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
      return createIfs(connection, bufferToJavaType, javaTypeToBuffer)
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
