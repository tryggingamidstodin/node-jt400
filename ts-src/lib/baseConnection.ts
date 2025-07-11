import { parse } from 'JSONStream'
import { JDBCConnection } from '../java/JT400'
import { BaseConnection, Param } from './baseConnection.types'
import { handleError } from './handleError'
import { CreateInsertList } from './insertList'
import { JdbcStream } from './jdbcstream'
import { createJdbcWriteStream } from './jdbcwritestream'
import { arrayToObject } from './streamTransformers'

function convertDateValues(v: any) {
  return v instanceof Date
    ? v.toISOString().replace('T', ' ').replace('Z', '')
    : v
}

function paramsToJson(params: Param[]) {
  return JSON.stringify((params || []).map(convertDateValues))
}

export const createBaseConnection = function (
  jdbcConnection: JDBCConnection,
  insertListFun: CreateInsertList,
  inMemory: boolean
): BaseConnection {
  const baseConnection: BaseConnection = {
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
            asObjectStream(options) {
              options = options || {}
              const parseJSON = parse('*')

              return statement
                .getMetaData()
                .then(JSON.parse)
                .then((metadata) => {
                  const transformArrayToObject = arrayToObject(metadata)
                  stream = new JdbcStream({
                    jdbcStream: statement.asStreamSync(
                      options.bufferSize || 100
                    ),
                  })

                  return stream.pipe(parseJSON).pipe(transformArrayToObject)
                })
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
        baseConnection.batchUpdate,
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
      return insertListFun(baseConnection)(tableName, idColumn, list)
    },

    isInMemory() {
      return inMemory
    },
  }
  return baseConnection
}
