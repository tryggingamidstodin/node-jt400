"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const stream_1 = require("stream");
function IfsReadStream(opt) {
    stream_1.Readable.call(this, {
        objectMode: false
    });
    this._ifsReadStream = opt.ifsReadStream;
    this._buffer = [];
}
exports.IfsReadStream = IfsReadStream;
util.inherits(IfsReadStream, stream_1.Readable);
IfsReadStream.prototype._read = function () {
    var _this = this;
    this._ifsReadStream.then(function (stream) {
        stream.read(function (err, res) {
            if (err) {
                _this.emit('error', err);
            }
            else {
                _this.push(res ? new Buffer(res) : null);
            }
        });
    }).fail(function (err) {
        _this.emit('error', err);
    });
};
//# sourceMappingURL=read_stream.js.map