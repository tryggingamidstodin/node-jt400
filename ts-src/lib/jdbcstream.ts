import { inherits } from 'util'
import { Readable } from 'stream'

export function JdbcStream(opt) {
  Readable.call(this, { objectMode: false })
  this._jdbcStream = opt.jdbcStream
  this._jdbcStreamPromise = opt.jdbcStreamPromise
}

inherits(JdbcStream, Readable)

function read(context) {
  if (context._closed) {
    context._jdbcStream.close().catch((err) => {
      if (err) {
        context.destroy(err)
      }
    })
    context.push(null)
  } else {
    context._jdbcStream
      .read()
      .then((res) => {
        context.push(res)
      })
      .catch((err) => {
        context.destroy(err)
      })
  }
}

JdbcStream.prototype.close = function () {
  this._closed = true
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
    .then((stream) => stream && stream.close())
    .catch(() => {
      // the original error (if any) is more relevant than a failed cleanup
    })
    .then(() => callback(err))
}
