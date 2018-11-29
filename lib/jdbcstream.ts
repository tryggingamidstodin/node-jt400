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
    context._jdbcStream.close(err => {
      if (err) {
        console.log('close error', err)
      }
    })
    context.push(null)
  } else {
    context._jdbcStream.read((err, res) => {
      if (err) {
        context.emit('error', err)
      } else {
        context.push(res)
      }
    })
  }
}

JdbcStream.prototype.close = function() {
  this._closed = true
}

JdbcStream.prototype._read = function() {
  const _this = this
  if (!this._jdbcStream) {
    this._jdbcStreamPromise
      .then(stream => {
        _this._jdbcStream = stream
        read(_this)
      })
      .fail(function(err) {
        this.emit('error', err)
      })
  } else {
    read(this)
  }
}
