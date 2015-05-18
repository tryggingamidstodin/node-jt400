'use strict';
var util = require('util'),
    Readable = require('stream').Readable;


function IfsReadStream (opt) {
    Readable.call(this, {objectMode: false});
    this._ifsReadStream = opt.ifsReadStream;
    this._buffer = [];
}

util.inherits(IfsReadStream, Readable);

IfsReadStream.prototype._read = function () {
    var _this = this;
    this._ifsReadStream.read(function (err, res) {
        if(err) {
            _this.emit('error', err);
        } else {
            _this.push(res ? new Buffer(res) : null);
        }
    });
};

module.exports = IfsReadStream;