import { Transform } from 'node:stream'

const whitespace = new Set([' ', '\n', '\r', '\t'])

export function parseJsonArray() {
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
      stream.push(JSON.parse(raw))
    }
  }

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _encoding, callback) {
      text += typeof chunk === 'string' ? chunk : chunk.toString()
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
      callback()
    },
  })
}
