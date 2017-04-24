import util = require('util')
import { newArray } from 'java';
import FlushWritable = require('flushwritable');


export function IfsWriteStream(opt) {
    FlushWritable.call(this, {
        objectMode: false
    });
    this._ifsWriteStream = opt.ifsWriteStream;
    this._buffer = [];
}

util.inherits(IfsWriteStream, FlushWritable);

IfsWriteStream.prototype._write = function(chunk, _, next) {
    this._ifsWriteStream.then(function(stream) {
        const byteArray = newArray('byte', Array.prototype.slice.call(chunk, 0))       
        stream.write(byteArray);
        next();
    }).catch((err) => {
        this.emit('error', err);
    });
};

IfsWriteStream.prototype._flush = function(done) {
    this._ifsWriteStream.then((stream) => {
        stream.flush();
    }).then(done).catch(done);
};