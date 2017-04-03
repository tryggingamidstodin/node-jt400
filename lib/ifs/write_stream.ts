import util = require('util')
import FlushWritable = require('flushwritable');


export function IfsWriteStream(opt) {
    FlushWritable.call(this, {
        objectMode: false
    });
    this._ifsWriteStream = opt.ifsWriteStream;
    this._buffer = [];
}

util.inherits(IfsWriteStream, FlushWritable);

IfsWriteStream.prototype._write = function(chunck, _, next) {
    this._ifsWriteStream.then(function(stream) {
        stream.write(chunck.toString());
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