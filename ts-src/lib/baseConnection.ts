import { parse } from 'JSONStream'
import { JDBCConnection } from '../java/JT400'
import { BaseConnection, Param } from './baseConnection.types'
import { handleError } from './handleError'
import { CreateInsertList } from './insertList'
import { JdbcStream } from './jdbcstream'
import { createJdbcWriteStream } from './jdbcwritestream'
import { Logger } from './logger'
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
  logger: Logger,
  inMemory: boolean
): BaseConnection {
  const baseConnection: BaseConnection = {
    query(sql, params = [], options) {
      const jsonParams = paramsToJson(params)

      // Sending default options to java
      const trim = options && options.trim !== undefined ? options.trim : true
      logger.debug(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB query'
      )
      const startTime = process.hrtime.bigint()
      return jdbcConnection
        .query(sql, jsonParams, trim)
        .then(JSON.parse)
        .then((result: any[]) => {
          logger.info(
            {
              sql,
              state: 'finished',
              duration: Number(process.hrtime.bigint() - startTime),
              parameterCount: params.length,
              resultSize: result.length,
            },
            'IBMI DB query executed'
          )
          return result
        })
        .catch(handleError({ sql, params }))
    },

    createReadStream(sql, params = []) {
      const jsonParams = paramsToJson(params)
      logger.debug(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB query as stream'
      )
      const startTime = process.hrtime.bigint()
      const stream = new JdbcStream({
        jdbcStreamPromise: jdbcConnection
          .queryAsStream(sql, jsonParams, 100)
          .catch(handleError({ sql, params })),
      })
      stream.on('end', () => {
        logger.info(
          {
            sql,
            state: 'finished',
            duration: Number(process.hrtime.bigint() - startTime),
            parameterCount: params.length,
          },
          'IBMI DB query as stream ended'
        )
      })
      return stream
    },

    execute(sql, params = []) {
      const jsonParams = paramsToJson(params)
      logger.debug(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB sql statement'
      )
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
              const startTime = process.hrtime.bigint()
              return statement
                .asArray()
                .then(JSON.parse)
                .then((result: any[]) => {
                  logger.info(
                    {
                      sql,
                      state: 'finished',
                      duration: Number(process.hrtime.bigint() - startTime),
                      parameterCount: params.length,
                      resultSize: result.length,
                    },
                    'IBMI DB query executed'
                  )
                  return result
                })
            },
            asStream(options) {
              const startTime = process.hrtime.bigint()
              options = options || {}
              stream = new JdbcStream({
                jdbcStream: statement.asStreamSync(options.bufferSize || 100),
              })
              stream.on('end', () => {
                logger.info(
                  {
                    sql,
                    state: 'finished',
                    duration: Number(process.hrtime.bigint() - startTime),
                    parameterCount: params.length,
                  },
                  'IBMI DB query as stream ended'
                )
              })
              return stream
            },
            asObjectStream(options) {
              const startTime = process.hrtime.bigint()
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
                  stream.on('end', () => {
                    logger.info(
                      {
                        sql,
                        state: 'finished',
                        duration: Number(process.hrtime.bigint() - startTime),
                        parameterCount: params.length,
                      },
                      'IBMI DB query as object stream ended'
                    )
                  })

                  return stream.pipe(parseJSON).pipe(transformArrayToObject)
                })
            },
            asIterable() {
              const startTime = process.hrtime.bigint()
              return {
                [Symbol.asyncIterator]() {
                  return {
                    async next() {
                      return statement
                        .next()
                        .then(JSON.parse)
                        .then((value) => {
                          const done = !Boolean(value)
                          if (done) {
                            logger.info(
                              {
                                sql,
                                state: 'finished',
                                duration: Number(
                                  process.hrtime.bigint() - startTime
                                ),
                                parameterCount: jsonParams.length,
                              },
                              'IBMI DB query as iterable executed'
                            )
                          }
                          return {
                            done,
                            value,
                          }
                        })
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
    update(sql, params = []) {
      const jsonParams = paramsToJson(params)
      logger.info(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB update'
      )
      const startTime = process.hrtime.bigint()
      return jdbcConnection
        .update(sql, jsonParams)
        .then((result) => {
          logger.info(
            {
              sql,
              state: 'finished',
              duration: Number(process.hrtime.bigint() - startTime),
              parameterCount: params.length,
              result: result,
            },
            'IBMI DB update executed'
          )
          return result
        })
        .catch(handleError({ sql, params }))
    },

    createWriteStream(sql, options) {
      logger.debug({ sql, state: 'starting' }, 'Executing IBMI DB write stream')
      const startTime = process.hrtime.bigint()
      const stream = createJdbcWriteStream(
        baseConnection.batchUpdate,
        sql,
        options && options.bufferSize
      )
      stream.on('finish', () => {
        logger.info(
          {
            sql,
            state: 'finished',
            duration: Number(process.hrtime.bigint() - startTime),
          },
          'IBMI DB write stream ended'
        )
      })
      return stream
    },

    batchUpdate(sql, paramsList) {
      const params = (paramsList || []).map((row) => {
        return row.map(convertDateValues)
      })

      const jsonParams = JSON.stringify(params)
      logger.info(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB batch update'
      )
      const startTime = process.hrtime.bigint()
      return jdbcConnection
        .batchUpdate(sql, jsonParams)
        .then((res) => {
          const result = Array.from(res)
          logger.info(
            {
              sql,
              state: 'finished',
              duration: Number(process.hrtime.bigint() - startTime),
              parameterCount: params.length,
              result: result,
            },
            'IBMI DB batch update executed'
          )
          return result
        })
        .catch(handleError({ sql, params }))
    },

    insertAndGetId(sql, params = []) {
      const jsonParams = paramsToJson(params)
      logger.info(
        { sql, state: 'starting', parameterCount: params.length },
        'Executing IBMI DB insert and get id'
      )
      const startTime = process.hrtime.bigint()
      return jdbcConnection
        .insertAndGetId(sql, jsonParams)
        .then((result) => {
          logger.info(
            {
              sql,
              state: 'finished',
              duration: Number(process.hrtime.bigint() - startTime),
              parameterCount: params.length,
            },
            'IBMI DB insert and get id executed'
          )
          return result
        })
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
