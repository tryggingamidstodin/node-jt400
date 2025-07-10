import { Readable } from 'stream'
import { arrayToObject } from '../lib/streamTransformers'
import { parse } from 'JSONStream'
import { expect } from 'chai'

describe('streamTransformers', () => {
  describe('arrayToObject', () => {
    it('should convert an array stream to objects', (done) => {
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
            ])
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)
      const parseJSON = parse('*')

      const objectStream = arrayStream
        .pipe(parseJSON)
        .pipe(transformArraysToObject)

      const results: any[] = []
      objectStream.on('data', (data) => {
        results.push(data)
      })

      objectStream.on('end', () => {
        expect(results).to.deep.equal([
          { id: 1, name: 'Jón' },
          { id: 2, name: 'Gunna' },
        ])
        done()
      })

      objectStream.on('error', done)
    })

    it('should throw error when not true json array', (done) => {
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
            ])
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)

      const objectStream = arrayStream.pipe(transformArraysToObject)

      objectStream.on('error', (err) => {
        try {
          expect(err.message).to.equal('Expected an array chunk as input')
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should throw error when column length and stream data length do not match', (done) => {
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
            ])
          )
          this.push(null)
        },
      })

      const transformArraysToObject = arrayToObject(metadata)
      const parseJSON = parse('*')

      const objectStream = arrayStream
        .pipe(parseJSON)
        .pipe(transformArraysToObject)

      objectStream.on('error', (err) => {
        try {
          expect(err.message).to.equal(
            'Array chunk length 3 does not match columns length 2'
          )
          done()
        } catch (e) {
          done(e)
        }
      })
    })
  })
})
