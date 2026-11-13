import { Readable } from 'stream'
import { JavaTypeToBuffer } from '../../java/index.js'
import { IfsReadStream as IfsReadStreamType } from '../../java/JT400.js'

export class IfsReadStream extends Readable {
  private _ifsReadStream: Promise<IfsReadStreamType>
  private _javaTypeToBuffer: JavaTypeToBuffer

  constructor(opt: {
    ifsReadStream: Promise<IfsReadStreamType>
    javaTypeToBuffer: JavaTypeToBuffer
  }) {
    super({ objectMode: false })
    this._ifsReadStream = opt.ifsReadStream
    this._javaTypeToBuffer = opt.javaTypeToBuffer
  }

  override _read() {
    this._ifsReadStream
      .then((stream) => {
        stream
          .read()
          .then((res) => {
            this.push(this._javaTypeToBuffer(res))
          })
          .catch((err) => {
            this.destroy(err)
          })
      })
      .catch((err) => {
        this.destroy(err)
      })
  }

  override _destroy(
    err: Error | null,
    callback: (error?: Error | null) => void,
  ) {
    void this._ifsReadStream
      .then((stream) => stream.close())
      .catch(() => {
        // the original error (if any) is more relevant than a failed cleanup
      })
      .then(() => callback(err))
  }
}
