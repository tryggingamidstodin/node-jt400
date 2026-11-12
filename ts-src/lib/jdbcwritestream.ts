import { Writable } from 'node:stream'

export function createJdbcWriteStream(batchUpdate, statement, bufferSize) {
  bufferSize = bufferSize || 100
  let dataBuffer: any[] = []

  function flush(done) {
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
      if (dataBuffer.length >= bufferSize) {
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
