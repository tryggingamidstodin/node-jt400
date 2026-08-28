import { inherits } from 'util'
import { Readable } from 'stream'
import { createDefaultLogger } from './logger.js'

export function JdbcStream(opt) {
  Readable.call(this, { objectMode: false })
  this._jdbcStream = opt.jdbcStream
  this._jdbcStreamPromise = opt.jdbcStreamPromise
  this._logger = opt.logger || createDefaultLogger()
  // Tracks whether the Java-side stream still owns a connection. It is set as
  // soon as a close is initiated, and also when the Java side closes itself
  // (end of data, or a read error it handles internally), so _destroy never
  // returns the same connection to the pool a second time.
  this._jdbcStreamClosed = false
  if (this._jdbcStreamPromise) {
    // Park a permanent no-op handler on the promise. _read attaches the real
    // handler, but only once a consumer actually reads. A stream that is
    // created and then never read would otherwise leave the rejection
    // unhandled, which terminates the process under Node's default policy.
    this._jdbcStreamPromise.catch(() => undefined)
  }
}

inherits(JdbcStream, Readable)

function closeJdbcStream(context, jdbcStream) {
  context._jdbcStreamClosed = true
  return jdbcStream.close().catch((err) => {
    // Failing to close is not fatal for the consumer: every row has already
    // been delivered. Report it through the logger rather than emitting
    // 'error', which crashes consumers that have no error listener attached.
    context._logger.error({ err }, 'IBMI DB result stream close failed')
  })
}

function read(context) {
  if (context._closed) {
    closeJdbcStream(context, context._jdbcStream)
    context.push(null)
  } else {
    context._jdbcStream
      .read()
      .then((res) => {
        if (res === null) {
          // End of data: the Java stream has already closed itself and
          // returned its connection, so _destroy must not close it again.
          context._jdbcStreamClosed = true
        }
        context.push(res)
      })
      .catch((err) => {
        // The Java stream closes itself before propagating a read failure.
        context._jdbcStreamClosed = true
        context.emit('error', err)
      })
  }
}

JdbcStream.prototype.close = function () {
  this._closed = true
}

/**
 * Release the Java-side result stream when this stream is destroyed -- either
 * by a consumer aborting early, or by an error raised further down a pipe()
 * chain. Without this the result set and its pooled connection are never
 * released, because the ordinary close path only runs on the next _read,
 * which in that situation never comes.
 */
JdbcStream.prototype._destroy = function (err, cb) {
  if (this._jdbcStreamClosed) {
    cb(err)
  } else if (this._jdbcStream) {
    closeJdbcStream(this, this._jdbcStream).then(() => cb(err))
  } else if (this._jdbcStreamPromise) {
    // Destroyed before the Java stream was ever handed over: close it as soon
    // as it materialises, otherwise it leaks a pooled connection.
    this._jdbcStreamPromise
      .then((jdbcStream) =>
        jdbcStream ? closeJdbcStream(this, jdbcStream) : undefined,
      )
      .catch(() => undefined)
    cb(err)
  } else {
    cb(err)
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
        this.emit('error', err)
      })
  } else {
    read(this)
  }
}
