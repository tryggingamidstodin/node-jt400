import { Writable } from 'node:stream'
import { Param } from './baseConnection.types.js'

export function createJdbcWriteStream(
  batchUpdate: (sql: string, params: Param[][]) => Promise<unknown>,
  statement: string,
  bufferSize?: number,
) {
  const size = bufferSize || 100
  let dataBuffer: Param[][] = []

  function flush(done: (error?: Error | null) => void) {
    const d = dataBuffer
    dataBuffer = []
    batchUpdate(statement, d)
      .then(() => {
        done()
      })
      .catch(done)
  }

  return new Writable({
    objectMode: true,
    write(chunk, _, next) {
      dataBuffer.push(chunk)
      if (dataBuffer.length >= size) {
        flush(next)
      } else {
        next()
      }
    },
    final(done) {
      if (dataBuffer.length) {
        flush(done)
      } else {
        done()
      }
    },
  })
}
