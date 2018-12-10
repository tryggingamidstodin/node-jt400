import { jt400 } from './db'
import { expect } from 'chai'
import * as streamEqual from 'stream-equal'
const { ifs } = jt400

describe('ifs', () => {
  it('should read file', done => {
    const stream = ifs().createReadStream('/atm/test/hello_world.txt')
    let data = ''
    stream.on('data', chunk => {
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
      length: 15
    })
  })

  it('should get metadata for file that does not exists', async () => {
    const metadata = await ifs().fileMetadata(
      '/atm/test/___file_that_does_not_exists____.txt'
    )

    expect(metadata).to.deep.equal({
      exists: false,
      length: 0
    })
  })

  it('should read filename promise', done => {
    const stream = ifs().createReadStream(
      Promise.resolve('/atm/test/hello_world.txt')
    )
    let data = ''
    stream.on('data', chunk => {
      data += chunk
    })

    stream.on('end', () => {
      expect(data).to.equal('Halló heimur!\n')
      done()
    })

    stream.on('error', done)
  }).timeout(50000)

  it('should write file', done => {
    const rs = ifs().createReadStream('/atm/test/hello_world.txt')
    const ws = ifs().createWriteStream('/atm/test2/new_file.txt', {
      append: false
    })

    rs.pipe(ws)
      .on('finish', () => {
        const stream = ifs().createReadStream('/atm/test2/new_file.txt')
        let data = ''
        stream.on('data', chunk => {
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
  }).timeout(50000)

  it('should pipe image', done => {
    const rs = ifs().createReadStream('/atm/test/image.jpg')
    const ws = ifs().createWriteStream('/atm/test2/image.jpg', {
      append: false
    })

    rs.pipe(ws).on('finish', () => {
      const oldImage = ifs().createReadStream('/atm/test/image.jpg')
      const newImage = ifs().createReadStream('/atm/test2/image.jpg')

      streamEqual(oldImage, newImage, (error, equal) => {
        expect(error).to.be.equal(null)
        expect(equal).to.be.equal(true)
        done()
      })
    })
  }).timeout(50000)
})
