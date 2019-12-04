"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const stream_1 = require("stream");
function JdbcStream(opt) {
    stream_1.Readable.call(this, { objectMode: false });
    this._jdbcStream = opt.jdbcStream;
    this._jdbcStreamPromise = opt.jdbcStreamPromise;
}
exports.JdbcStream = JdbcStream;
util_1.inherits(JdbcStream, stream_1.Readable);
function read(context) {
    if (context._closed) {
        context._jdbcStream.close(err => {
            if (err) {
                console.log('close error', err);
            }
        });
        context.push(null);
    }
    else {
        context._jdbcStream.read((err, res) => {
            if (err) {
                context.emit('error', err);
            }
            else {
                context.push(res);
            }
        });
    }
}
JdbcStream.prototype.close = function () {
    this._closed = true;
};
JdbcStream.prototype._read = function () {
    if (!this._jdbcStream) {
        this._jdbcStreamPromise
            .then(stream => {
            this._jdbcStream = stream;
            read(this);
        })
            .catch(err => {
            this.emit('error', err);
        });
    }
    else {
        read(this);
    }
};
//# sourceMappingURL=jdbcstream.js.map