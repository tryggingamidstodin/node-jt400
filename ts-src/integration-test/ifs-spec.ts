import { expect } from 'chai'
import * as streamEqual from 'stream-equal'
import { jt400 } from './db'
const { ifs } = jt400

describe('ifs', () => {
  it('should read file', (done) => {
    const stream = ifs().createReadStream('/atm/test/hello_world.txt')
    let data = ''
    stream.on('data', (chunk) => {
      data += chunk
    })

    stream.on('end', () => {
      expect(data).to.equal('Halló heimur!\n')
      done()
    })

    stream.on('error', done)
  }).timeout(50000)

  it('should get file metadata', async () => {
    const metadata = await ifs().fileMetadata('/atm/test/hello_world.txt')
    expect(metadata).to.deep.equal({
      exists: true,
      length: 15,
    })
  })
  describe('list files', () => {
    it('should list files', async () => {
      const files = await ifs().listFiles('/atm/test')
      expect(files.length).to.be.above(0)
    })
    it('should return empty array for empty folder', async () => {
      const files = await ifs().listFiles('/atm/test/emptyFolder')
      expect(files.length).to.equal(0)
    })
    it('should return empty array for a folder that does not exist', async () => {
      const files = await ifs().listFiles('/atm/test/does-not-exist')
      expect(files.length).to.equal(0)
    })
    it('should return empty array if the folder is a file', async () => {
      const files = await ifs().listFiles('/atm/test/hello_world.txt')
      expect(files.length).to.equal(0)
    })
  })
  describe('move file', () => {
    it('should return true if the file exist', async () => {
      const res = await ifs().moveFile(
        '/atm/test/file-to-move.txt',
        '/atm/test/file-moved.txt'
      )
      expect(res).to.equal(true)
      await ifs().moveFile(
        '/atm/test/file-moved.txt',
        '/atm/test/file-to-move.txt'
      )
    })
    it('should return false if the file does not exist', async () => {
      const res = await ifs().moveFile(
        '/atm/test/does-not-exist.txt',
        '/atm/test/does-not-exist2.txt'
      )
      expect(res).to.equal(false)
    })
  })

  it('should get metadata for file that does not exists', async () => {
    const metadata = await ifs().fileMetadata(
      '/atm/test/___file_that_does_not_exists____.txt'
    )

    expect(metadata).to.deep.equal({
      exists: false,
      length: 0,
    })
  })

  it('should read filename promise', (done) => {
    const stream = ifs().createReadStream(
      Promise.resolve('/atm/test/hello_world.txt')
    )
    let data = ''
    stream.on('data', (chunk) => {
      data += chunk
    })

    stream.on('end', () => {
      expect(data).to.equal('Halló heimur!\n')
      done()
    })

    stream.on('error', done)
  }).timeout(50000)

  it('should write file', (done) => {
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
          expect(data).to.equal('Halló heimur!\n')
          done()
          /*
                        ifs().deleteFile('/atm/test2/new_file.txt')
                            .then((res) => {
                                expect(res).to.equal(true);
                                done();
                            })
                            .catch(done);
        */
        })

        stream.on('error', done)
      })
      .on('error', done)
  }).timeout(5000)

  it('should pipe image', () => {
    const rs = ifs().createReadStream('/atm/test/image.jpg')
    const ws = ifs().createWriteStream('/atm/test2/image.jpg', {
      append: false,
    })

    rs.pipe(ws).on('finish', () => {
      const oldImage = ifs().createReadStream('/atm/test/image.jpg')
      const newImage = ifs().createReadStream('/atm/test2/image.jpg')

      return streamEqual(oldImage, newImage).then((equal) => {
        expect(equal).to.be.equal(true)
      })
    })
  }).timeout(50000)
})
