'use strict';
import { IfsReadStream } from './read_stream'
import { IfsWriteStream } from './write_stream'
import { dirname, basename } from 'path'
import q = require('q')

export function ifs(connection) {
    return {
        createReadStream: function(fileName) {
            var javaStream = q.when(fileName).then(function(file) {
                return q.nfcall(connection.createIfsReadStream.bind(connection), file);
            });
            return new IfsReadStream({
                ifsReadStream: javaStream
            });
        },
        createWriteStream: function(fileName, options) {
            options = options || { append: false }

            var javaStream = q.when(fileName).then(function(file) {
                const folderPath = dirname(file);
                const fileName = basename(file);
                return q.nfcall(connection.createIfsWriteStream.bind(connection), folderPath, fileName, options.append);
            });
            return new IfsWriteStream({
                ifsWriteStream: javaStream
            });
        },
        deleteFile: (fileName) => q.nfcall(connection.deleteIfsFile.bind(connection), fileName),
        fileMetadata: fileName =>
            q
                .nfcall(
                    connection.getIfsFileMetadata.bind(connection),
                    fileName
                )
                .then(JSON.parse),
    };
}
