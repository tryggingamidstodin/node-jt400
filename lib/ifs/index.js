'use strict';
var IfsReadStream = require('./read_stream'),
    q = require('q');

function ifs(connection) {
    return {
        createReadStream: function(fileName) {
            var javaStream = q.when(fileName).then(function (file) {
                return q.nfcall(connection.createIfsReadStream.bind(connection), file);
            });
            return new IfsReadStream({
                ifsReadStream: javaStream
            });
        }
    };
}

module.exports = ifs;
