'use strict';
import { IfsReadStream } from './read_stream'
import q = require('q')

export function ifs(connection) {
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
