/// <reference types="node" />
import { Readable, Writable } from 'stream';
export interface WriteStreamOptions {
    bufferSize: number;
}
export interface PgmParamType1 {
    name: string;
    size: number;
    type?: string;
    decimals?: number;
}
export interface PgmParamType2 {
    name: string;
    precision: number;
    typeName?: string;
    scale?: number;
}
export interface PgmParamStructType {
    [key: string]: PgmParamType[];
}
export declare type PgmParamType = PgmParamType1 | PgmParamType2 | PgmParamStructType;
export interface CLOB {
    type: 'CLOB';
    value: string;
}
export declare type Param = string | number | Date | null | CLOB;
export interface JustNameMessageQ {
    name: string;
}
export interface JustMessageDataQ {
    path: string;
}
export declare type MessageQOptions = JustNameMessageQ | JustMessageDataQ;
export interface MessageQReadOptions {
    wait?: number;
}
export interface KeyedDataQReadOptions {
    key: string;
    wait?: number;
    writeKeyLength?: number;
}
export interface MessageFileHandlerOptions {
    path: string;
}
export interface MessageFileReadOptions {
    messageId: string[7];
}
export interface MessageQ {
    sendInformational: (messageText: string) => Promise<void>;
    read: (params?: MessageQReadOptions) => Promise<any> | Promise<null>;
}
export interface KeyedDataQOptions {
    name: string;
}
export interface KeyedDataQ {
    write: (key: string, data: string) => void;
    read: (params: KeyedDataQReadOptions | string) => Promise<any>;
}
export interface AS400Message {
    getText: (cb: (err: any, data: string) => void) => void;
    getTextSync: () => string;
    getTextPromise: () => Promise<string>;
}
export interface MessageFileHandler {
    read: (params: MessageFileReadOptions) => AS400Message;
}
export interface IfsFileMetadata {
    exists: boolean;
    length: number;
}
export interface Ifs {
    createReadStream: (fileName: string | Promise<string>) => Readable;
    createWriteStream: (fileName: string | Promise<string>, options?: {
        append: boolean;
    }) => Writable;
    deleteFile: (fileName: string) => Promise<boolean>;
    fileMetadata: (fileName: string) => Promise<IfsFileMetadata>;
}
export interface BaseConnection {
    query: <T>(sql: string, params?: Param[]) => Promise<T[]>;
    update: (sql: string, params?: Param[]) => Promise<number>;
    isInMemory: () => boolean;
    createReadStream: (sql: string, params?: Param[]) => Readable;
    insertAndGetId: (sql: string, params?: Param[]) => Promise<number>;
    insertList: (tableName: string, idColumn: string, rows: any[]) => Promise<number[]>;
    createWriteStream: (sql: string, options?: WriteStreamOptions) => Writable;
    batchUpdate: (sql: string, params?: Param[][]) => Promise<number[]>;
    execute: (sql: string, params?: Param[]) => Promise<any>;
}
export declare type TransactionFun = (transaction: BaseConnection) => Promise<any>;
export interface Connection extends BaseConnection {
    pgm: (programName: string, paramsSchema: PgmParamType[]) => any;
    getTablesAsStream: (params: any) => Readable;
    getColumns: (params: any) => any;
    getPrimaryKeys: (params: any) => any;
    transaction: (fn: TransactionFun) => Promise<any>;
    openMessageQ: (params: MessageQOptions) => MessageQ;
    createKeyedDataQ: (params: KeyedDataQOptions) => KeyedDataQ;
    openMessageFile: (params: MessageFileHandlerOptions) => MessageFileHandler;
    ifs: () => Ifs;
}
export interface InMemoryConnection extends Connection {
    mockPgm: (programName: string, fn: (input: any) => any) => InMemoryConnection;
}
export declare function pool(config?: any): Connection;
export declare function connect(config?: any): any;
export declare function useInMemoryDb(): InMemoryConnection;
