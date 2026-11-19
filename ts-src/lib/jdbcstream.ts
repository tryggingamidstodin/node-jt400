import { Readable } from 'stream'
import { Logger, createDefaultLogger } from './logger.js'
import { ResultStream } from '../java/JT400.js'

export interface JdbcStreamOptions {
  jdbcStream?: ResultStream
  jdbcStreamPromise?: Promise<ResultStream>
  logger?: Logger
}

export class JdbcStream extends Readable {
  private _jdbcStream?: ResultStream
  private _jdbcStreamPromise?: Promise<ResultStream>
  private _logger: Logger
  private _closed = false
  private _releasePromise?: Promise<void>
  private _ending = false
  private _reading = false

  constructor(opt: JdbcStreamOptions) {
    super({ objectMode: false })
    this._jdbcStream = opt.jdbcStream
    this._jdbcStreamPromise = opt.jdbcStreamPromise
    this._logger = opt.logger || createDefaultLogger()
    if (this._jdbcStreamPromise) {
      // _read only attaches a handler once a consumer reads. A stream that is
      // created and never read would otherwise leave a rejected promise
      // unhandled, which terminates the process under Node's default policy.
      this._jdbcStreamPromise.catch(() => undefined)
    }
  }

  private fetch(stream: ResultStream) {
    if (this.destroyed || this._ending) return
    if (this._closed) {
      this.finish(stream)
    } else {
      this._reading = true
      stream
        .read()
        .then((res) => {
          this._reading = false
          if (this.destroyed) return
          if (res !== null) this.push(res)
          if (res === null || this._closed) {
            this.finish(stream)
          }
        })
        .catch((err) => {
          this._reading = false
          this.destroy(err)
        })
    }
  }

  private release(stream: ResultStream): Promise<void> {
    if (!this._releasePromise) {
      this._releasePromise = Promise.resolve()
        .then(() => stream.close())
        .catch((err) => {
          this._logger.error({ err }, 'IBMI DB result stream close failed')
        })
    }
    return this._releasePromise
  }

  private finish(stream: ResultStream) {
    if (this._ending || this.destroyed) return
    this._ending = true
    void this.release(stream).then(() => {
      if (!this.destroyed) this.push(null)
    })
  }

  /**
   * Ends the stream early. Remaining rows are dropped, the Java stream (and its
   * pooled connection) is released and the stream ends normally. The release
   * happens right away unless a read is in flight, because waiting for the next
   * _read would leak the connection when nobody reads again.
   */
  close() {
    this._closed = true
    if (this.destroyed) {
      return
    }
    if (this._jdbcStream) {
      if (!this._reading) {
        this.fetch(this._jdbcStream)
      }
    } else if (this._jdbcStreamPromise) {
      // Acquisition is still pending and no read may ever happen, so release
      // the resource as soon as it resolves instead of waiting for _read.
      this._jdbcStreamPromise
        .then((stream) => {
          this._jdbcStream = stream
          if (!this._reading && !this.destroyed) {
            this.fetch(stream)
          }
        })
        .catch((err) => this.destroy(err))
    }
  }

  override _read() {
    if (this._ending || this.destroyed) return
    if (this._jdbcStream) {
      this.fetch(this._jdbcStream)
    } else {
      this._jdbcStreamPromise!.then((stream) => {
        this._jdbcStream = stream
        this.fetch(stream)
      }).catch((err) => {
        this.destroy(err)
      })
    }
  }

  override _destroy(
    err: Error | null,
    callback: (error?: Error | null) => void,
  ) {
    void Promise.resolve(this._jdbcStream ?? this._jdbcStreamPromise)
      // A failed acquisition leaves nothing to close. It is not a cleanup
      // failure, so it must not be logged as one below.
      .catch(() => undefined)
      .then((stream) => {
        if (stream) return this.release(stream)
      })
      .then(() => callback(err))
  }
}
