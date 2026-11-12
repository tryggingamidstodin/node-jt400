import util from 'util'
import { Readable } from 'stream'
import { JavaTypeToBuffer } from '../../java/index.js'
import { IfsReadStream as IfsReadStreamType } from '../../java/JT400.js'

export function IfsReadStream(opt: {
  ifsReadStream: Promise<IfsReadStreamType>
  javaTypeToBuffer: JavaTypeToBuffer
}) {
  Readable.call(this, {
    objectMode: false,
  })
  this._ifsReadStream = opt.ifsReadStream
  this._javaTypeToBuffer = opt.javaTypeToBuffer
  this._buffer = []
}

util.inherits(IfsReadStream, Readable)

IfsReadStream.prototype._read = function () {
  const _this = this
  const streamPromise: Promise<IfsReadStreamType> = this._ifsReadStream
  streamPromise
    .then((stream) => {
      stream
        .read()
        .then((res) => {
          this.push(this._javaTypeToBuffer(res))
        })
        .catch((err) => {
          _this.destroy(err)
        })
    })
    .catch((err) => {
      this.destroy(err)
    })
}

IfsReadStream.prototype._destroy = function (err, callback) {
  const streamPromise: Promise<IfsReadStreamType> = this._ifsReadStream
  void streamPromise
    .then((stream) => stream.close())
    .catch(() => {
      // the original error (if any) is more relevant than a failed cleanup
    })
    .then(() => callback(err))
}
