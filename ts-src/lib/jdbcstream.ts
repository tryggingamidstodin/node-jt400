import { inherits } from 'util'
import { Readable } from 'stream'
import { createDefaultLogger } from './logger.js'

export function JdbcStream(opt) {
  Readable.call(this, { objectMode: false })
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

inherits(JdbcStream, Readable)

function read(context) {
  if (context._closed) {
    if (!context._javaClosed) {
      context._javaClosed = true
      context._jdbcStream.close().catch((err) => {
        // Every requested row has been delivered, or the consumer ended the
        // stream on purpose. A failing close is reported through the logger
        // rather than as an 'error', which would crash consumers that have no
        // error listener attached.
        context._logger.error({ err }, 'IBMI DB result stream close failed')
      })
    }
    context.push(null)
  } else {
    context._reading = true
    context._jdbcStream
      .read()
      .then((res) => {
        context._reading = false
        context.push(res)
        if (res !== null && context._closed) {
          // close() was called while this read was in flight and the push
          // above may not trigger another _read (e.g. full buffer).
          read(context)
        }
      })
      .catch((err) => {
        context._reading = false
        context.destroy(err)
      })
  }
}

/**
 * Ends the stream early. Remaining rows are dropped, the Java stream (and its
 * pooled connection) is released and the stream ends normally. The release
 * happens right away unless a read is in flight, because waiting for the next
 * _read would leak the connection when nobody reads again.
 */
JdbcStream.prototype.close = function () {
  this._closed = true
  if (this.destroyed) {
    return
  }
  if (this._jdbcStream) {
    if (!this._reading) {
      read(this)
    }
  } else if (this._jdbcStreamPromise) {
    // Acquisition is still pending and no read may ever happen, so release
    // the resource as soon as it resolves instead of waiting for _read.
    this._jdbcStreamPromise
      .then((stream) => {
        this._jdbcStream = stream
        if (!this._reading && !this.destroyed) {
          read(this)
        }
      })
      .catch((err) => this.destroy(err))
  }
}

JdbcStream.prototype._read = function () {
  if (!this._jdbcStream) {
    this._jdbcStreamPromise
      .then((stream) => {
        this._jdbcStream = stream
        read(this)
      })
      .catch((err) => {
        this.destroy(err)
      })
  } else {
    read(this)
  }
}

JdbcStream.prototype._destroy = function (err, callback) {
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
