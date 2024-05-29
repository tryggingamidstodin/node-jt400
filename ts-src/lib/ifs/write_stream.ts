import { BufferToJavaType } from '../../java'
import { IfsWriteStream as IfsWriteStreamType } from '../../java/JT400'
import util = require('util')
import FlushWritable = require('flushwritable')

export function IfsWriteStream(opt: {
  ifsWriteStream: Promise<IfsWriteStreamType>
  bufferToJavaType: BufferToJavaType
}) {
  FlushWritable.call(this, {
    objectMode: false,
  })
  this._ifsWriteStream = opt.ifsWriteStream
  this._bufferToJavaType = opt.bufferToJavaType
  this._buffer = []
}

util.inherits(IfsWriteStream, FlushWritable)

IfsWriteStream.prototype._write = function (chunk, _, next) {
  const writeStream: Promise<IfsWriteStreamType> = this._ifsWriteStream
  writeStream
    .then((stream) => {
      return stream.write(this._bufferToJavaType(chunk))
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
