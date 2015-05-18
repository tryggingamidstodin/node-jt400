'use strict';
var IfsReadStream = require('./read_stream');

function ifs(connection) {
    return {
        createReadStream: function(fileName) {
            var javaStream = connection.createIfsReadStreamSync(fileName);
            return new IfsReadStream({
                ifsReadStream: javaStream
            });
        }
    };
}

module.exports = ifs;
