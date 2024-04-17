import { BaseConnection, InsertList } from './baseConnection.types'
import { toInsertSql } from './sqlutil'

export type CreateInsertList = (connection: BaseConnection) => InsertList
export const createInsertListInOneStatment: CreateInsertList =
  (jt400) => (tableName, idColumn, list) => {
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

    return jt400.query<any>(sql, params).then((idList) => {
      return idList.map((idObj) => idObj[idColumn.toUpperCase()])
    })
  }

export const createStandardInsertList: CreateInsertList =
  (jt400) => (tableName, _, list) => {
    const idList = []
    const pushToIdList = idList.push.bind(idList)

    return list
      .map((record) => {
        return {
          sql: toInsertSql(tableName, [record]),
          values: Object.values(record),
        }
      })
      .reduce((soFar, sqlObj: any) => {
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
