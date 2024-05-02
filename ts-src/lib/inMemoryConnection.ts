import { createConnection } from './connection'
import { Connection } from './connection.types'
import { createStandardInsertList } from './insertList'
import { JT400Factory } from '../java'

export interface InMemoryConnection extends Connection {
  mockPgm: (programName: string, fn: (input: any) => any) => InMemoryConnection
}

export function createInMemoryConnection(
  jt400Factory: JT400Factory
): InMemoryConnection {
  const javaCon = jt400Factory.createInMemoryConnection()
  const instance = createConnection(javaCon, createStandardInsertList, true)
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
