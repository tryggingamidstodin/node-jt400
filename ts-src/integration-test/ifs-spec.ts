import assert from 'assert'
import { describe, it } from 'node:test'
import { once } from 'events'
import { pipeline } from 'stream/promises'
import { buffer } from 'stream/consumers'
import { jt400 } from './db.js'
const { ifs } = jt400

describe('ifs', () => {
  it('should read file', { timeout: 50000 }, async () => {
    const stream = ifs().createReadStream('/atm/test/hello_world.txt')
    const data = (await buffer(stream)).toString()
    assert.strictEqual(data, 'Halló heimur!\n')
  })

  it('should get file metadata', async () => {
    const metadata = await ifs().fileMetadata('/atm/test/hello_world.txt')
    assert.deepStrictEqual(metadata, {
      exists: true,
      length: 15,
    })
  })
  describe('list files', () => {
    it('should list files', async () => {
      const files = await ifs().listFiles('/atm/test')
      assert.ok(files.length > 0)
    })
    it('should return empty array for empty folder', async () => {
      const files = await ifs().listFiles('/atm/test/emptyFolder')
      assert.strictEqual(files.length, 0)
    })
    it('should return empty array for a folder that does not exist', async () => {
      const files = await ifs().listFiles('/atm/test/does-not-exist')
      assert.strictEqual(files.length, 0)
    })
    it('should return empty array if the folder is a file', async () => {
      const files = await ifs().listFiles('/atm/test/hello_world.txt')
      assert.strictEqual(files.length, 0)
    })
  })
  describe('move file', () => {
    it('should return true if the file exist', async () => {
      const res = await ifs().moveFile(
        '/atm/test/file-to-move.txt',
        '/atm/test/file-moved.txt',
      )
      assert.strictEqual(res, true)
      await ifs().moveFile(
        '/atm/test/file-moved.txt',
        '/atm/test/file-to-move.txt',
      )
    })
    it('should return false if the file does not exist', async () => {
      const res = await ifs().moveFile(
        '/atm/test/does-not-exist.txt',
        '/atm/test/does-not-exist2.txt',
      )
      assert.strictEqual(res, false)
    })
  })

  it('should get metadata for file that does not exists', async () => {
    const metadata = await ifs().fileMetadata(
      '/atm/test/___file_that_does_not_exists____.txt',
    )

    assert.deepStrictEqual(metadata, {
      exists: false,
      length: 0,
    })
  })

  it('should read filename promise', { timeout: 50000 }, async () => {
    const stream = ifs().createReadStream(
      Promise.resolve('/atm/test/hello_world.txt'),
    )
    const data = (await buffer(stream)).toString()
    assert.strictEqual(data, 'Halló heimur!\n')
  })

  it('should write file', { timeout: 5000 }, async () => {
    const rs = ifs().createReadStream('/atm/test/hello_world.txt')
    const ws = ifs().createWriteStream('/atm/test2/new_file.txt', {
      append: false,
    })
    await pipeline(rs, ws)

    const stream = ifs().createReadStream('/atm/test2/new_file.txt')
    const data = (await buffer(stream)).toString()
    assert.strictEqual(data, 'Halló heimur!\n')
  })

  it('should pipe image', { timeout: 50000 }, async () => {
    const rs = ifs().createReadStream('/atm/test/image.jpg')
    const ws = ifs().createWriteStream('/atm/test2/image.jpg', {
      append: false,
    })
    await pipeline(rs, ws)

    const oldImage = ifs().createReadStream('/atm/test/image.jpg')
    const newImage = ifs().createReadStream('/atm/test2/image.jpg')
    const [a, b] = await Promise.all([buffer(oldImage), buffer(newImage)])
    assert.strictEqual(a.equals(b), true)
  })

  it('should create an empty file when nothing is written', async () => {
    const path = '/atm/test2/empty_file.txt'
    const ws = ifs().createWriteStream(path, { append: false })
    ws.end()
    await once(ws, 'finish')
    const metadata = await ifs().fileMetadata(path)
    assert.deepStrictEqual(metadata, { exists: true, length: 0 })
  })
})
