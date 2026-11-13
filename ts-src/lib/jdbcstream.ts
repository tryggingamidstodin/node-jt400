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
  private _javaClosed = false
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
    if (this._closed) {
      if (!this._javaClosed) {
        this._javaClosed = true
        stream.close().catch((err) => {
          // Every requested row has been delivered, or the consumer ended the
          // stream on purpose. A failing close is reported through the logger
          // rather than as an 'error', which would crash consumers that have no
          // error listener attached.
          this._logger.error({ err }, 'IBMI DB result stream close failed')
        })
      }
      this.push(null)
    } else {
      this._reading = true
      stream
        .read()
        .then((res) => {
          this._reading = false
          this.push(res)
          if (res !== null && this._closed) {
            // close() was called while this read was in flight and the push
            // above may not trigger another _read (e.g. full buffer).
            this.fetch(stream)
          }
        })
        .catch((err) => {
          this._reading = false
          this.destroy(err)
        })
    }
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
      .then((stream) => {
        if (stream && !this._javaClosed) {
          this._javaClosed = true
          return stream.close()
        }
      })
      .catch((cleanupErr) => {
        // the original error (if any) is more relevant than a failed cleanup
        this._logger.error(
          { err: cleanupErr },
          'IBMI DB result stream close failed',
        )
      })
      .then(() => callback(err))
  }
}
