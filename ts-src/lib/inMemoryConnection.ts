import { JavaBridge } from '../java/index.js'
import { createConnection } from './connection.js'
import { Connection } from './connection.types.js'
import { createStandardInsertList } from './insertList.js'
import { Logger } from './logger.js'

type PgmMock = (input: any) => any

export interface InMemoryConnection extends Connection {
  mockPgm: (programName: string, fn: PgmMock) => InMemoryConnection
}

export function createInMemoryConnection(
  jt400Factory: JavaBridge,
  logger: Logger,
): InMemoryConnection {
  const javaCon = jt400Factory.createInMemoryConnection()
  const instance = createConnection({
    connection: javaCon,
    insertListFun: createStandardInsertList,
    bufferToJavaType: jt400Factory.bufferToJavaType,
    javaTypeToBuffer: jt400Factory.javaTypeToBuffer,
    logger,
    inMemory: true,
  })
  const pgmMockRegistry: Record<string, (input: any, timeout: number) => any> =
    {}

  const defaultPgm = instance.defineProgram
  instance.defineProgram = function (opt) {
    const defaultFunc = defaultPgm(opt)
    return function (params: unknown, timeout = 3) {
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
