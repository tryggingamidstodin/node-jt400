import util = require('util')
import { Readable } from 'stream'

export function IfsReadStream(opt) {
  Readable.call(this, {
    objectMode: false
  })
  this._ifsReadStream = opt.ifsReadStream
  this._buffer = []
}

util.inherits(IfsReadStream, Readable)

IfsReadStream.prototype._read = function() {
  const _this = this
  this._ifsReadStream
    .then(stream => {
      stream.read((err, res) => {
        if (err) {
          _this.emit('error', err)
        } else {
          this.push(res ? Buffer.from(res) : null)
        }
      })
    })
    .fail(err => {
      this.emit('error', err)
    })
}
