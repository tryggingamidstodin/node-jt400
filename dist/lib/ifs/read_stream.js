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
    const _this = this;
    this._ifsReadStream
        .then(stream => {
        stream.read((err, res) => {
            if (err) {
                _this.emit('error', err);
            }
            else {
                this.push(res ? Buffer.from(res) : null);
            }
        });
    })
        .fail(err => {
        this.emit('error', err);
    });
};
//# sourceMappingURL=read_stream.js.map