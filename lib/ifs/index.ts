import { IfsReadStream } from './read_stream'
import { IfsWriteStream } from './write_stream'
import { dirname, basename } from 'path'

export function ifs(connection) {
  return {
    createReadStream: function (fileName: string | Promise<string>) {
      const javaStream = Promise.resolve(fileName).then(function (file) {
        return connection.createIfsReadStream(file)
      })
      return new IfsReadStream({
        ifsReadStream: javaStream,
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
      })
    },
    deleteFile: (fileName: string) => connection.deleteIfsFile(fileName),
    fileMetadata: (fileName: string) =>
      connection.getIfsFileMetadata(fileName).then(JSON.parse),
  }
}
