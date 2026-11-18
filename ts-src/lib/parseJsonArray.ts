import { Transform } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

const whitespace = new Set([' ', '\n', '\r', '\t'])

/**
 * Transform that parses a stream of JSON text holding one array and emits its
 * elements one at a time, e.g. the rows of `createReadStream`.
 *
 * - `null` elements are skipped: an object mode stream uses `null` to signal
 *   its end, so they cannot be emitted.
 * - Input that ends in the middle of an element fails with an error. Input
 *   that ends between two elements is accepted, because that is what a result
 *   stream that was closed early looks like.
 */
export function parseJsonArray() {
  const decoder = new StringDecoder('utf8')
  let text = ''
  let index = 0
  let depth = 0
  let inString = false
  let escape = false
  let elementStart = -1

  const emitElement = (stream: Transform, end: number) => {
    const raw = text.slice(elementStart, end).trim()
    elementStart = -1
    if (raw) {
      const element = JSON.parse(raw)
      if (element !== null) {
        stream.push(element)
      }
    }
  }

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _encoding, callback) {
      text += typeof chunk === 'string' ? chunk : decoder.write(chunk)
      try {
        while (index < text.length) {
          const char = text[index]

          if (inString) {
            if (escape) {
              escape = false
            } else if (char === '\\') {
              escape = true
            } else if (char === '"') {
              inString = false
            }
            index++
            continue
          }

          if (char === '"') {
            if (depth === 1 && elementStart < 0) {
              elementStart = index
            }
            inString = true
            index++
            continue
          }

          if (char === '{' || char === '[') {
            if (depth === 1) {
              elementStart = index
            }
            depth++
            index++
            continue
          }

          if (char === '}' || char === ']') {
            if (depth === 1 && elementStart >= 0) {
              emitElement(this, index)
            }
            depth--
            if (depth === 1 && elementStart >= 0) {
              emitElement(this, index + 1)
            }
            index++
            continue
          }

          if (depth === 1 && char === ',') {
            if (elementStart >= 0) {
              emitElement(this, index)
            }
            index++
            continue
          }

          if (depth === 1 && elementStart < 0 && !whitespace.has(char)) {
            elementStart = index
          }

          index++
        }

        const keepFrom = elementStart >= 0 ? elementStart : index
        if (keepFrom > 0) {
          text = text.slice(keepFrom)
          index -= keepFrom
          if (elementStart >= 0) {
            elementStart = 0
          }
        }
        callback()
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)))
      }
    },
    flush(callback) {
      // drain any incomplete trailing bytes held by the decoder
      text += decoder.end()
      if (depth > 1 || inString || elementStart >= 0) {
        callback(new Error('Unexpected end of JSON input inside an element'))
        return
      }
      callback()
    },
  })
}
