import { initJT400Factory } from './java'
import { Connection } from './lib/connection.types'
import { createConnection } from './lib/connection'
import { createInsertListInOneStatment } from './lib/insertList'
import {
  InMemoryConnection,
  createInMemoryConnection,
} from './lib/inMemoryConnection'

export * from './lib/connection.types'
export * from './lib/baseConnection.types'
export * from './lib/ifs/types'
export { InMemoryConnection }

const defaultConfig = {
  host: process.env.AS400_HOST,
  user: process.env.AS400_USERNAME,
  password: process.env.AS400_PASSWORD,
  naming: 'system',
}

const jt400Factory = initJT400Factory()

export function pool(config = {}): Connection {
  const javaCon = jt400Factory.createPool(
    JSON.stringify({ ...defaultConfig, ...config })
  )
  return createConnection(javaCon, createInsertListInOneStatment, false)
}
export async function connect(config = {}): Promise<Connection> {
  const javaCon = await jt400Factory.createConnection(
    JSON.stringify({ ...defaultConfig, ...config })
  )
  return createConnection(javaCon, createInsertListInOneStatment, false)
}

export function useInMemoryDb(): InMemoryConnection {
  return createInMemoryConnection(jt400Factory)
}
