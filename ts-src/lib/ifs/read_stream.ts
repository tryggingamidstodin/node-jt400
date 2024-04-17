import util = require('util')
import { Readable } from 'stream'

export function IfsReadStream(opt) {
  Readable.call(this, {
    objectMode: false,
  })
  this._ifsReadStream = opt.ifsReadStream
  this._buffer = []
}

util.inherits(IfsReadStream, Readable)

IfsReadStream.prototype._read = function () {
  const _this = this
  this._ifsReadStream
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
