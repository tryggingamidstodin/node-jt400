import { Transform, TransformCallback } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

const whitespace = new Set([' ', '\n', '\r', '\t'])
type State = 'start' | 'first' | 'value' | 'delimiter' | 'done'
type Token = 'string' | 'compound' | 'primitive'

/**
 * Parses a JSON array into a stream of elements. Null elements are skipped.
 * Empty input and input ending between elements are accepted for early close.
 */
export function parseJsonArray() {
  const decoder = new StringDecoder('utf8')
  let text = ''
  let index = 0
  let state: State = 'start'
  let token: Token | undefined
  let elementStart = -1
  const brackets: string[] = []
  let inString = false
  let escape = false
  let pending: TransformCallback | undefined

  const emitElement = (stream: Transform, end: number): boolean => {
    const element = JSON.parse(text.slice(elementStart, end))
    elementStart = -1
    token = undefined
    state = 'delimiter'
    return element === null || stream.push(element)
  }

  const processInput = (stream: Transform, callback: TransformCallback) => {
    try {
      let canPush = true
      while (index < text.length && canPush) {
        const char = text[index]

        if (token === 'primitive') {
          if (whitespace.has(char) || char === ',' || char === ']') {
            canPush = emitElement(stream, index)
            continue // process the delimiter separately
          }
          index++
          continue
        }

        if (token === 'string' || token === 'compound') {
          if (inString) {
            if (escape) escape = false
            else if (char === '\\') escape = true
            else if (char === '"') inString = false
            index++
            if (!inString && token === 'string') {
              canPush = emitElement(stream, index)
            }
            continue
          }
          if (char === '"') {
            inString = true
          } else if (char === '[' || char === '{') {
            brackets.push(char)
          } else if (char === ']' || char === '}') {
            const opening = brackets.pop()
            if (opening !== (char === ']' ? '[' : '{')) {
              throw new SyntaxError('Mismatched JSON brackets')
            }
            index++
            if (brackets.length === 0) {
              canPush = emitElement(stream, index)
            }
            continue
          }
          index++
          continue
        }

        if (whitespace.has(char)) {
          index++
          continue
        }
        if (state === 'start') {
          if (char !== '[') throw new SyntaxError('Expected a JSON array')
          state = 'first'
          index++
        } else if (state === 'done') {
          throw new SyntaxError('Unexpected content after JSON array')
        } else if (state === 'delimiter') {
          if (char === ',') state = 'value'
          else if (char === ']') state = 'done'
          else throw new SyntaxError('Expected a comma or end of JSON array')
          index++
        } else if (char === ']' && state === 'first') {
          state = 'done'
          index++
        } else {
          if (char === ']' || char === ',' || char === '}') {
            throw new SyntaxError('Expected a JSON array element')
          }
          elementStart = index
          if (char === '"') {
            token = 'string'
            inString = true
          } else if (char === '[' || char === '{') {
            token = 'compound'
            brackets.push(char)
          } else {
            token = 'primitive'
          }
          index++
        }
      }

      const keepFrom = elementStart >= 0 ? elementStart : index
      text = text.slice(keepFrom)
      index -= keepFrom
      if (elementStart >= 0) elementStart = 0
      if (canPush) callback()
      else pending = callback
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _encoding, callback) {
      text += decoder.write(chunk)
      processInput(this, callback)
    },
    read(size) {
      if (pending) {
        const callback = pending
        pending = undefined
        processInput(this, callback)
      }
      Transform.prototype._read.call(this, size)
    },
    flush(callback) {
      text += decoder.end()
      processInput(this, (err) => {
        if (err) return callback(err)
        // Empty streams and streams stopped between elements are produced by
        // empty queries and by JdbcStream.close().
        if (token) {
          callback(new Error('Unexpected end of JSON input inside an element'))
        } else {
          callback()
        }
      })
    },
  })
}
