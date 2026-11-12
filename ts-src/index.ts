import { initJavaBridge } from './java/index.js'
import { createConnection } from './lib/connection.js'
import { Connection } from './lib/connection.types.js'
import {
  createInMemoryConnection,
  type InMemoryConnection,
} from './lib/inMemoryConnection.js'
import { createInsertListInOneStatment } from './lib/insertList.js'
import { createDefaultLogger, type Logger } from './lib/logger.js'
import { parseJsonArray } from './lib/parseJsonArray.js'

export { parseJsonArray }

export * from './lib/baseConnection.types.js'
export * from './lib/connection.types.js'
export * from './lib/ifs/types.js'
export type { InMemoryConnection, Logger }

const defaultConfig = {
  host: process.env.AS400_HOST,
  user: process.env.AS400_USERNAME,
  password: process.env.AS400_PASSWORD,
  naming: 'system',
}

let javaBridge: ReturnType<typeof initJavaBridge> | null = null

function getJavaBridge() {
  if (!javaBridge) {
    javaBridge = initJavaBridge()
  }
  return javaBridge
}
export type JT400Options = {
  logger?: Logger
}
export function pool(config = {}, options: JT400Options = {}): Connection {
  const bridge = getJavaBridge()
  const javaCon = bridge.createPool(
    JSON.stringify({ ...defaultConfig, ...config }),
  )
  return createConnection({
    connection: javaCon,
    insertListFun: createInsertListInOneStatment,
    bufferToJavaType: bridge.bufferToJavaType,
    javaTypeToBuffer: bridge.javaTypeToBuffer,
    logger: options.logger || createDefaultLogger(),
    inMemory: false,
  })
}
export async function connect(
  config = {},
  options: JT400Options = {},
): Promise<Connection> {
  const bridge = getJavaBridge()
  const javaCon = await bridge.createConnection(
    JSON.stringify({ ...defaultConfig, ...config }),
  )
  return createConnection({
    connection: javaCon,
    insertListFun: createInsertListInOneStatment,
    bufferToJavaType: bridge.bufferToJavaType,
    javaTypeToBuffer: bridge.javaTypeToBuffer,
    logger: options.logger || createDefaultLogger(),
    inMemory: false,
  })
}

export function useInMemoryDb(options: JT400Options = {}): InMemoryConnection {
  return createInMemoryConnection(
    getJavaBridge(),
    options.logger || createDefaultLogger(),
  )
}
