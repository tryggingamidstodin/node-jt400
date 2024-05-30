import { initJavaBridge } from './java'
import { createConnection } from './lib/connection'
import { Connection } from './lib/connection.types'
import {
  InMemoryConnection,
  createInMemoryConnection,
} from './lib/inMemoryConnection'
import { createInsertListInOneStatment } from './lib/insertList'

export * from './lib/baseConnection.types'
export * from './lib/connection.types'
export * from './lib/ifs/types'
export { InMemoryConnection }

const defaultConfig = {
  host: process.env.AS400_HOST,
  user: process.env.AS400_USERNAME,
  password: process.env.AS400_PASSWORD,
  naming: 'system',
}

const javaBridge = initJavaBridge()

export function pool(config = {}): Connection {
  const javaCon = javaBridge.createPool(
    JSON.stringify({ ...defaultConfig, ...config })
  )
  return createConnection({
    connection: javaCon,
    insertListFun: createInsertListInOneStatment,
    bufferToJavaType: javaBridge.bufferToJavaType,
    javaTypeToBuffer: javaBridge.javaTypeToBuffer,
    inMemory: false,
  })
}
export async function connect(config = {}): Promise<Connection> {
  const javaCon = await javaBridge.createConnection(
    JSON.stringify({ ...defaultConfig, ...config })
  )
  return createConnection({
    connection: javaCon,
    insertListFun: createInsertListInOneStatment,
    bufferToJavaType: javaBridge.bufferToJavaType,
    javaTypeToBuffer: javaBridge.javaTypeToBuffer,
    inMemory: false,
  })
}

export function useInMemoryDb(): InMemoryConnection {
  return createInMemoryConnection(javaBridge)
}
