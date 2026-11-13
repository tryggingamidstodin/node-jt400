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
