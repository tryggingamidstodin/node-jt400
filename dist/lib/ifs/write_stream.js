"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const java_1 = require("java");
const FlushWritable = require("flushwritable");
function IfsWriteStream(opt) {
    FlushWritable.call(this, {
        objectMode: false
    });
    this._ifsWriteStream = opt.ifsWriteStream;
    this._buffer = [];
}
exports.IfsWriteStream = IfsWriteStream;
util.inherits(IfsWriteStream, FlushWritable);
IfsWriteStream.prototype._write = function (chunk, _, next) {
    this._ifsWriteStream
        .then(stream => {
        const byteArray = java_1.newArray('byte', Array.prototype.slice.call(chunk, 0));
        stream.write(byteArray);
        next();
    })
        .catch(err => {
        this.emit('error', err);
    });
};
IfsWriteStream.prototype._flush = function (done) {
    this._ifsWriteStream.then(stream => stream.flush(err => {
        if (err) {
            done(err);
        }
        else {
            done();
        }
    }));
};
//# sourceMappingURL=write_stream.js.map