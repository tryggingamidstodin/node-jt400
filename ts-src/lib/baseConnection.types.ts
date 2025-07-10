import { Readable, Writable } from 'stream'
export { Readable, Writable }

export interface CLOB {
  type: 'CLOB'
  value: string
}

export interface BLOB {
  type: 'BLOB'
  value: string
}

export type Param = string | number | Date | null | CLOB | BLOB

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
  asObjectStream: (options?: any) => Promise<Readable>
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

export interface WriteStreamOptions {
  bufferSize: number
}

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
  batchUpdate: BatchUpdate
  execute: Execute
}
