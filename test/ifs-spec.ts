'use strict';
import { pool } from '../lib/jt400'
import { expect } from 'chai'
import q = require('q')
const { ifs } = pool()

describe('ifs', function() {
    it('should read file', function(done) {
        this.timeout(50000);
        var stream = ifs().createReadStream('/atm/test/hello_world.txt');
        var data = '';
        stream.on('data', function(chunk) {
            data += chunk;
        });

        stream.on('end', function() {
            expect(data).to.equal('Halló heimur!\n');
            done();
        });

        stream.on('error', done);
    });

    it('should read filename promise', function(done) {
        this.timeout(50000);
        var stream = ifs().createReadStream(q('/atm/test/hello_world.txt'));
        var data = '';
        stream.on('data', function(chunk) {
            data += chunk;
        });

        stream.on('end', function() {
            expect(data).to.equal('Halló heimur!\n');
            done();
        });

        stream.on('error', done);
    });

    it('should write file', function(done) {
        this.timeout(50000);
        const rs = ifs().createReadStream('/atm/test/hello_world.txt');

        const ws = ifs().createWriteStream('/atm/test/new_file.txt', { append: false });

        rs.pipe(ws).on('finish', function() {
            var stream = ifs().createReadStream('/atm/test/new_file.txt');
            var data = '';
            stream.on('data', function(chunk) {
                data += chunk;
            });

            stream.on('end', function() {
                expect(data).to.equal('Halló heimur!\n');
                ifs().deleteFile('/atm/test/new_file.txt')
                    .then((res) => {
                        expect(res).to.equal(true);
                        done();
                    })
                    .catch(done);
            });

            stream.on('error', done);
        }).on('error', done);
    });
});