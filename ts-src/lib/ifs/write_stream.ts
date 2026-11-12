import { BufferToJavaType } from '../../java/index.js'
import { IfsWriteStream as IfsWriteStreamType } from '../../java/JT400.js'
import util from 'util'
import { Writable } from 'stream'

export function IfsWriteStream(opt: {
  ifsWriteStream: Promise<IfsWriteStreamType>
  bufferToJavaType: BufferToJavaType
}) {
  Writable.call(this, {
    objectMode: false,
    final: (done) => this._flush(done),
  })
  this._ifsWriteStream = opt.ifsWriteStream
  this._bufferToJavaType = opt.bufferToJavaType
  this._buffer = []
}

util.inherits(IfsWriteStream, Writable)

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
