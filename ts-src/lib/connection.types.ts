import { Readable } from 'stream'
import { BaseConnection, Close } from './baseConnection.types'
import { Ifs } from './ifs/types'

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
    libraryName?: string
  ) => any
  defineProgram: (options: ProgramDefinitionOptions) => any
  getTablesAsStream: (params: any) => Readable
  getColumns: (params: any) => any
  getPrimaryKeys: (params: any) => any
  transaction: (fn: TransactionFun) => Promise<any>
  openMessageQ: (params: MessageQOptions) => Promise<MessageQ>
  createKeyedDataQ: (params: DataQOptions) => KeyedDataQ
  openMessageFile: (
    params: MessageFileHandlerOptions
  ) => Promise<MessageFileHandler>
  ifs: () => Ifs
  close: Close
}
