import util = require('util')
import FlushWritable = require('flushwritable')
import { IfsWriteStream as IfsWriteStreamType } from '../../java/JT400'

export function IfsWriteStream(opt: {
  ifsWriteStream: Promise<IfsWriteStreamType>
}) {
  FlushWritable.call(this, {
    objectMode: false,
  })
  this._ifsWriteStream = opt.ifsWriteStream
  this._buffer = []
}

util.inherits(IfsWriteStream, FlushWritable)

IfsWriteStream.prototype._write = function (chunk, _, next) {
  const writeStream: Promise<IfsWriteStreamType> = this._ifsWriteStream
  writeStream
    .then((stream) => {
      return stream.write(chunk)
    })
    .then(() => {
      next()
    })
    .catch((err) => {
      this.emit('error', err)
    })
}

IfsWriteStream.prototype._flush = function (done) {
  const writeStream: Promise<IfsWriteStreamType> = this._ifsWriteStream
  writeStream
    .then((stream) => stream.flush())
    .then(() => {
      done()
    })
    .catch((err) => {
      done(err)
    })
}
