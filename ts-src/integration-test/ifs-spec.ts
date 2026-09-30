import assert from 'assert'
import { buffer } from 'node:stream/consumers'
import { describe, it } from 'node:test'
import { jt400 } from './db.js'
const { ifs } = jt400

describe('ifs', () => {
  it('should read file', { timeout: 50000 }, (_t, done) => {
    const stream = ifs().createReadStream('/atm/test/hello_world.txt')
    let data = ''
    stream.on('data', (chunk) => {
      data += chunk
    })

    stream.on('end', () => {
      assert.strictEqual(data, 'Halló heimur!\n')
      done()
    })

    stream.on('error', done)
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

  it('should read filename promise', { timeout: 50000 }, (_t, done) => {
    const stream = ifs().createReadStream(
      Promise.resolve('/atm/test/hello_world.txt'),
    )
    let data = ''
    stream.on('data', (chunk) => {
      data += chunk
    })

    stream.on('end', () => {
      assert.strictEqual(data, 'Halló heimur!\n')
      done()
    })

    stream.on('error', done)
  })

  it('should write file', { timeout: 5000 }, (_t, done) => {
    const rs = ifs().createReadStream('/atm/test/hello_world.txt')
    const ws = ifs().createWriteStream('/atm/test2/new_file.txt', {
      append: false,
    })

    rs.pipe(ws)
      .on('finish', () => {
        const stream = ifs().createReadStream('/atm/test2/new_file.txt')
        let data = ''
        stream.on('data', (chunk) => {
          data += chunk
        })

        stream.on('end', () => {
          assert.strictEqual(data, 'Halló heimur!\n')
          done()
          /*
                        ifs().deleteFile('/atm/test2/new_file.txt')
                            .then((res) => {
                                assert.strictEqual(res, true);
                                done();
                            })
                            .catch(done);
        */
        })

        stream.on('error', done)
      })
      .on('error', done)
  })

  it('should pipe image', { timeout: 50000 }, () => {
    const rs = ifs().createReadStream('/atm/test/image.jpg')
    const ws = ifs().createWriteStream('/atm/test2/image.jpg', {
      append: false,
    })

    rs.pipe(ws).on('finish', () => {
      const oldImage = ifs().createReadStream('/atm/test/image.jpg')
      const newImage = ifs().createReadStream('/atm/test2/image.jpg')

      return Promise.all([buffer(oldImage), buffer(newImage)]).then(
        ([oldBytes, newBytes]) => {
          assert.ok(oldBytes.equals(newBytes))
        },
      )
    })
  })
})
