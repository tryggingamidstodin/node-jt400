import assert from 'assert'
import { describe, it, after } from 'node:test'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { jt400 } from './db.js'
const { ifs } = jt400

// Mirrors the default in java/src/nodejt400/IfsReadStream.java. The Java side
// reads JT400_IFS_READ_BUFFER (or -Djt400.ifs.readBuffer), so run with
// JT400_IFS_READ_BUFFER=10000 to compare against the old behaviour.
const configured = parseInt(process.env.JT400_IFS_READ_BUFFER ?? '', 10)
const EXPECTED_BUFFER = configured > 0 ? configured : 65536

const FILE_SIZE = 8 * 1024 * 1024
const PATH = '/atm/test2/read_throughput.bin'

function makeFile(size: number): Buffer {
  // deterministic, non-repeating-per-block content so a dropped or
  // duplicated chunk is detected by the integrity check
  const data = Buffer.alloc(size)
  for (let i = 0; i < size; i += 4) {
    data.writeUInt32BE((i / 4) >>> 0, i)
  }
  return data
}

describe('ifs read throughput', () => {
  after(async () => {
    await ifs().deleteFile(PATH)
  })

  it(
    'should read a large file in full-size blocks',
    { timeout: 120000 },
    async () => {
      const expected = makeFile(FILE_SIZE)
      await pipeline(
        Readable.from([expected], { objectMode: false }),
        ifs().createWriteStream(PATH, { append: false }),
      )
      const metadata = await ifs().fileMetadata(PATH)
      assert.strictEqual(metadata.length, FILE_SIZE)

      const chunks: Buffer[] = []
      const start = process.hrtime.bigint()
      for await (const chunk of ifs().createReadStream(PATH)) {
        chunks.push(chunk as Buffer)
      }
      const seconds = Number(process.hrtime.bigint() - start) / 1e9

      const actual = Buffer.concat(chunks)
      assert.ok(actual.equals(expected), 'content read back must match')

      const maxChunk = Math.max(...chunks.map((c) => c.length))
      const mbPerSecond = FILE_SIZE / 1024 / 1024 / seconds
      console.log(
        `ifs read: ${FILE_SIZE} bytes in ${seconds.toFixed(2)}s ` +
          `(${mbPerSecond.toFixed(2)} MB/s), ${chunks.length} chunks, ` +
          `max chunk ${maxChunk}, expected buffer ${EXPECTED_BUFFER}`,
      )

      // The number of round-trips is what the buffer size controls. If the
      // host server caps reads below the buffer, this fails and shows it.
      assert.strictEqual(maxChunk, EXPECTED_BUFFER)
      assert.ok(
        chunks.length <= Math.ceil(FILE_SIZE / EXPECTED_BUFFER) + 1,
        `expected about ${Math.ceil(FILE_SIZE / EXPECTED_BUFFER)} chunks, got ${chunks.length}`,
      )
    },
  )
})
