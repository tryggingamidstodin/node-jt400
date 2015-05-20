'use strict';
var IfsReadStream = require('./read_stream'),
    q = require('q');

function ifs(connection) {
    return {
        createReadStream: function(fileName) {
            var javaStream = q.nfcall(connection.createIfsReadStream.bind(connection), fileName);
            return new IfsReadStream({
                ifsReadStream: javaStream
            });
        }
    };
}

module.exports = ifs;
