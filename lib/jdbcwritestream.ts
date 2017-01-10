import FlushWritable = require('flushwritable');

export function createJdbcWriteStream(batchUpdate, statement, bufferSize) {
    bufferSize = bufferSize || 100;
    var ws = new FlushWritable({objectMode: true});
    var dataBuffer: any[] = [];

    function flush(done) {
        var d = dataBuffer;
        dataBuffer = [];
        batchUpdate(statement, d).then(function() {
            done();
        }).fail(done);
    }

    ws._write = function(chunck, _, next) {
        dataBuffer.push(chunck);
        if(dataBuffer.length >= bufferSize) {
            flush(next);
        } else {
            next();
        }
    };

    ws._flush = function(done) {
        if(dataBuffer.length) {
            flush(done);
        } else {
            done();
        }
    };
    return ws;
}
