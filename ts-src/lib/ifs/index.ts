import { basename, dirname } from 'path'
import { BufferToJavaType, JavaTypeToBuffer } from '../../java'
import { JT400 } from '../../java/JT400'
import { IfsReadStream } from './read_stream'
import { Ifs } from './types'
import { IfsWriteStream } from './write_stream'

export function ifs(
  connection: JT400,
  bufferToJavaType: BufferToJavaType,
  javaTypeToBuffer: JavaTypeToBuffer
): Ifs {
  return {
    createReadStream: function (fileName: string | Promise<string>) {
      const javaStream = Promise.resolve(fileName).then(function (file) {
        return connection.createIfsReadStream(file)
      })
      return new IfsReadStream({
        ifsReadStream: javaStream,
        javaTypeToBuffer,
      })
    },
    createWriteStream: function (
      fileName: string | Promise<string>,
      options: { append: boolean; ccsid?: number } = { append: false }
    ) {
      const javaStream = Promise.resolve(fileName).then(function (file) {
        const folderPath = dirname(file)
        const fileName = basename(file)
        return connection.createIfsWriteStream(
          folderPath,
          fileName,
          options.append,
          options.ccsid
        )
      })
      return new IfsWriteStream({
        ifsWriteStream: javaStream,
        bufferToJavaType,
      })
    },
    listFiles: async (folderName: string) => {
      const files = await connection.listIfsFiles(folderName)
      return files || []
    },
    moveFile: (fileName: string, newFileName: string) =>
      connection.moveIfsFile(fileName, newFileName),
    deleteFile: (fileName: string) => connection.deleteIfsFile(fileName),
    fileMetadata: (fileName: string) =>
      connection.getIfsFileMetadata(fileName).then(JSON.parse),
  }
}
