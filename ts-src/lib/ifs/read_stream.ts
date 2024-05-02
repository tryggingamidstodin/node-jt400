import util = require('util')
import { Readable } from 'stream'
import { IfsReadStream as IfsReadStreamType } from '../../java/JT400'

export function IfsReadStream(opt: {
  ifsReadStream: Promise<IfsReadStreamType>
}) {
  Readable.call(this, {
    objectMode: false,
  })
  this._ifsReadStream = opt.ifsReadStream
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
          this.push(res)
        })
        .catch((err) => {
          _this.emit('error', err)
        })
    })
    .catch((err) => {
      this.emit('error', err)
    })
}
