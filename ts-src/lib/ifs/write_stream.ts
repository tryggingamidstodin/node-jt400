import { Writable } from 'node:stream'
import { BufferToJavaType } from '../../java/index.js'
import { IfsWriteStream as IfsWriteStreamType } from '../../java/JT400.js'

export class IfsWriteStream extends Writable {
  private _ifsWriteStream: Promise<IfsWriteStreamType>
  private _bufferToJavaType: BufferToJavaType

  constructor(opt: {
    ifsWriteStream: Promise<IfsWriteStreamType>
    bufferToJavaType: BufferToJavaType
  }) {
    super({ objectMode: false })
    this._ifsWriteStream = opt.ifsWriteStream
    this._bufferToJavaType = opt.bufferToJavaType
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    next: (error?: Error | null) => void,
  ) {
    this._ifsWriteStream
      .then((stream) => stream.write(this._bufferToJavaType(chunk)))
      .then(() => {
        next()
      })
      .catch((err) => {
        next(err)
      })
  }

  override _destroy(
    err: Error | null,
    callback: (error?: Error | null) => void,
  ) {
    void this._ifsWriteStream
      .then((stream) => stream.close())
      .catch(() => {
        // the original error (if any) is more relevant than a failed cleanup
      })
      .then(() => callback(err))
  }

  override _final(done: (error?: Error | null) => void) {
    this._ifsWriteStream
      .then((stream) => stream.flush())
      .then(() => {
        done()
      })
      .catch((err) => {
        done(err)
      })
  }
}
