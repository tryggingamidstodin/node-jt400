import { IfsReadStream } from './read_stream'
import { IfsWriteStream } from './write_stream'
import { dirname, basename } from 'path'
import q = require('q')

export function ifs(connection) {
  return {
    createReadStream(fileName) {
      const javaStream = q.when(fileName).then(file => {
        return q.nfcall(connection.createIfsReadStream.bind(connection), file)
      })
      return new IfsReadStream({
        ifsReadStream: javaStream
      })
    },
    createWriteStream(fileName, options) {
      options = options || { append: false }
      const javaStream = q.when(fileName).then(file => {
        const folderPath = dirname(file)
        const fileName = basename(file)
        return q.nfcall(
          connection.createIfsWriteStream.bind(connection),
          folderPath,
          fileName,
          options.append
        )
      })

      return new IfsWriteStream({
        ifsWriteStream: javaStream
      })
    },
    deleteFile(fileName) {
      return q.nfcall(connection.deleteIfsFile.bind(connection), fileName)
    },
    fileMetadata(fileName) {
      return q
        .nfcall(connection.getIfsFileMetadata.bind(connection), fileName)
        .then(JSON.parse)
    }
  }
}
