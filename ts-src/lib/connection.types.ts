import { Readable } from 'stream'
import { BaseConnection, Close } from './baseConnection.types.js'
import { Ifs } from './ifs/types.js'

export interface ProgramDefinitionOptions {
  programName: string
  paramsSchema: PgmParamType[]
  libraryName?: string
  ccsid?: number
}

export interface PgmParamType1 {
  name: string
  size: number
  type?: string
  decimals?: number
}

export interface PgmParamType2 {
  name: string
  precision: number
  typeName?: string
  scale?: number
}

export interface PgmParamStructType {
  [key: string]: PgmParamType[]
}

export type PgmParamType = PgmParamType1 | PgmParamType2 | PgmParamStructType

export interface JustNameMessageQ {
  name: string
}
export interface JustPathMessageQ {
  path: string
}
export type MessageQOptions = JustNameMessageQ | JustPathMessageQ

export interface MessageQReadOptions {
  wait?: number
}

export interface DataQReadOptions {
  key: string
  wait?: number
  writeKeyLength?: number
}
export interface MessageFileHandlerOptions {
  /** Message File Location, e.g. /QSYS.LIB/YOURLIBRARY.LIB/YOURMSGFILE.MSGF */
  path: string
}
export interface MessageFileReadOptions {
  /** Message Key */
  messageId: string[7]
}

export interface MessageQ {
  sendInformational: (messageText: string) => Promise<void>
  read: (params?: MessageQReadOptions) => Promise<any> | Promise<null>
}

export interface DataQOptions {
  name: string
}
export interface KeyedDataQ {
  write: (key: string, data: string) => void
  read: (params: DataQReadOptions | string) => Promise<any>
}

export interface DataQPathOptions {
  /** Data queue location, e.g. /QSYS.LIB/YOURLIBRARY.LIB/YOURDTAQ.DTAQ */
  path: string
}
export interface DataQWaitOptions {
  /**
   * Seconds to wait for an entry. Defaults to 0, which does not wait. -1 waits
   * until there is one, holding a pooled connection the whole time.
   */
  wait?: number
}
/** A plain (sequential, non-keyed) data queue. */
export interface DataQ {
  write: (data: string) => Promise<void>
  /**
   * Removes the next entry from the queue and returns it. Resolves with null
   * when there is no entry within the wait. Does not wait by default.
   */
  read: (params?: DataQWaitOptions) => Promise<string | null>
  /**
   * Returns the next entry without removing it from the queue. Resolves with
   * null when there is no entry within the wait. Does not wait by default.
   */
  peek: (params?: DataQWaitOptions) => Promise<string | null>
}

export interface AS400Message {
  getText: () => Promise<string>
}

export interface MessageFileHandler {
  read: (params: MessageFileReadOptions) => Promise<AS400Message>
}

export type TransactionFun = (transaction: BaseConnection) => Promise<any>

export interface Connection extends BaseConnection {
  pgm: (
    programName: string,
    paramsSchema: PgmParamType[],
    libraryName?: string,
  ) => any
  defineProgram: (options: ProgramDefinitionOptions) => any
  getTablesAsStream: (params: any) => Readable
  getColumns: (params: any) => any
  getPrimaryKeys: (params: any) => any
  transaction: (fn: TransactionFun) => Promise<any>
  openMessageQ: (params: MessageQOptions) => Promise<MessageQ>
  createKeyedDataQ: (params: DataQOptions) => KeyedDataQ
  createDataQ: (params: DataQOptions | DataQPathOptions) => DataQ
  openMessageFile: (
    params: MessageFileHandlerOptions,
  ) => Promise<MessageFileHandler>
  ifs: () => Ifs
  close: Close
}
