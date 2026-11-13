import { Transform } from 'stream'
import { Metadata } from './baseConnection.types.js'

export function arrayToObject(metadata: Pick<Metadata, 'name'>[]) {
  const columnNames = metadata.map((md) => md.name)

  const transformer = new Transform({
    objectMode: true,
    transform(chunk, _, callback) {
      try {
        if (!Array.isArray(chunk)) {
          return callback(new Error('Expected an array chunk as input'))
        }

        if (chunk.length !== columnNames.length) {
          return callback(
            new Error(
              `Array chunk length ${chunk.length} does not match columns length ${columnNames.length}`,
            ),
          )
        }

        const obj: Record<string, unknown> = {}
        for (let i = 0; i < columnNames.length; i++) {
          obj[columnNames[i]] = chunk[i]
        }

        callback(null, obj)
      } catch (err) {
        callback(err as Error)
      }
    },
  })

  return transformer
}
