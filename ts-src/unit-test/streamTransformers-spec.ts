import assert from 'assert'
import { describe, it } from 'node:test'
import { once } from 'events'
import { Readable } from 'stream'
import { parseJsonArray } from '../lib/parseJsonArray.js'
import { arrayToObject } from '../lib/streamTransformers.js'

describe('streamTransformers', () => {
  describe('parseJsonArray', () => {
    it('should preserve UTF-8 characters split across chunks', async () => {
      const bytes = Buffer.from('[["é"]]')
      const split = bytes.indexOf(0xc3) + 1
      const stream = Readable.from(
        [bytes.subarray(0, split), bytes.subarray(split)],
        { objectMode: false },
      ).pipe(parseJsonArray())

      const results: any[] = []
      for await (const data of stream) results.push(data)
      assert.deepStrictEqual(results, [['é']])
    })

    const parse = async (...chunks: string[]) => {
      const stream = Readable.from(chunks, { objectMode: false }).pipe(
        parseJsonArray(),
      )
      const results: any[] = []
      for await (const data of stream) results.push(data)
      return results
    }

    it('should skip null elements', async () => {
      assert.deepStrictEqual(await parse('[1,null,2, null ]'), [1, 2])
      assert.deepStrictEqual(await parse('[[1,null],null,[null]]'), [
        [1, null],
        [null],
      ])
    })

    it('should fail when the input ends inside an element', async () => {
      for (const truncated of ['[[1,"a"],[2,"b"', '[[1,"a"],[2,"b', '[1,2']) {
        await assert.rejects(
          () => parse(truncated),
          /Unexpected end of JSON input/,
          truncated,
        )
      }
    })

    it('should accept input that ends between elements or is empty', async () => {
      assert.deepStrictEqual(await parse('[[1,"a"],', '[2,"b"]'), [
        [1, 'a'],
        [2, 'b'],
      ])
      assert.deepStrictEqual(await parse('[[1,"a"]'), [[1, 'a']])
      assert.deepStrictEqual(await parse(), [])
      assert.deepStrictEqual(await parse('[]'), [])
    })

    it('rejects invalid array syntax and trailing content', async () => {
      for (const invalid of [
        'garbage',
        '[1,]',
        '[,1]',
        '[1,,2]',
        '[[1][2]]',
        '[1]garbage',
        '[1][2]',
        '[[1}]',
      ]) {
        await assert.rejects(
          () => parse(invalid),
          { name: 'SyntaxError' },
          invalid,
        )
      }
    })

    it('parses split scalar and nested values', async () => {
      assert.deepStrictEqual(
        await parse('["a', '\\"b",tr', 'ue,', '42,', '{"x":[1,2]}]'),
        ['a"b', true, 42, { x: [1, 2] }],
      )
    })

    it('respects backpressure while parsing a large chunk', async () => {
      const parser = parseJsonArray()
      const values = Array.from({ length: 10000 }, (_, i) => [i])
      parser.end(JSON.stringify(values))
      assert.ok(parser.readableLength <= parser.readableHighWaterMark)
      const result: unknown[] = []
      for await (const row of parser) result.push(row)
      assert.deepStrictEqual(result, values)
    })
  })

  describe('arrayToObject', () => {
    it('should convert an array stream to objects', async () => {
      const metadata = [
        { name: 'id', typeName: 'INTEGER' },
        { name: 'name', typeName: 'VARCHAR' },
      ]

      const arrayStream = new Readable({
        read() {
          this.push(
            JSON.stringify([
              [1, 'Jón'],
              [2, 'Gunna'],
            ]),
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)
      const parseJSON = parseJsonArray()

      const objectStream = arrayStream
        .pipe(parseJSON)
        .pipe(transformArraysToObject)

      const results: any[] = []
      for await (const data of objectStream) results.push(data)

      assert.deepStrictEqual(results, [
        { id: 1, name: 'Jón' },
        { id: 2, name: 'Gunna' },
      ])
    })

    it('should throw error when not true json array', async () => {
      const metadata = [
        { name: 'id', typeName: 'INTEGER' },
        { name: 'name', typeName: 'VARCHAR' },
      ]

      const arrayStream = new Readable({
        read() {
          this.push(
            JSON.stringify([
              [1, 'Jón'],
              [2, 'Gunna'],
            ]),
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)

      const objectStream = arrayStream.pipe(transformArraysToObject)

      const [err] = await once(objectStream, 'error')
      assert.strictEqual(err.message, 'Expected an array chunk as input')
    })

    it('should throw error when column length and stream data length do not match', async () => {
      const metadata = [
        { name: 'id', typeName: 'INTEGER' },
        { name: 'name', typeName: 'VARCHAR' },
      ]

      const arrayStream = new Readable({
        read() {
          this.push(
            JSON.stringify([
              [1, 'Jón', 'extra'],
              [2, 'Gunna', 'extra'],
            ]),
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)
      const parseJSON = parseJsonArray()

      const objectStream = arrayStream
        .pipe(parseJSON)
        .pipe(transformArraysToObject)

      const [err] = await once(objectStream, 'error')
      assert.strictEqual(
        err.message,
        'Array chunk length 3 does not match columns length 2',
      )
    })
  })
})
