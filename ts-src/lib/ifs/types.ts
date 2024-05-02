import { Readable, Writable } from 'stream'

export interface IfsFileMetadata {
  exists: boolean
  length: number
}

export interface Ifs {
  createReadStream: (fileName: string | Promise<string>) => Readable
  createWriteStream: (
    fileName: string | Promise<string>,
    options?: { append: boolean; ccsid?: number }
  ) => Writable
  deleteFile: (fileName: string) => Promise<boolean>
  fileMetadata: (fileName: string) => Promise<IfsFileMetadata>
}
