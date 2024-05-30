import util = require('util')
import { Readable } from 'stream'
import { JavaTypeToBuffer } from '../../java'
import { IfsReadStream as IfsReadStreamType } from '../../java/JT400'

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
          _this.emit('error', err)
        })
    })
    .catch((err) => {
      this.emit('error', err)
    })
}
