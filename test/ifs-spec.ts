'use strict';
import { pool } from '../lib/jt400'
import { expect } from 'chai'
import q = require('q')
const jt400 = pool()

describe('ifs', function () {
    it('should read file', function (done) {
        this.timeout(50000);
        var stream = jt400.ifs().createReadStream('/atm/test/hello_world.txt');
        var data = '';
        stream.on('data', function (chunk) {
            data += chunk;
        });

        stream.on('end', function () {
            expect(data).to.equal('Halló heimur!\n');
            done();
        });

        stream.on('error', done);
    });

    it('should read filename promise', function (done) {
        this.timeout(50000);
        var stream = jt400.ifs().createReadStream(q('/atm/test/hello_world.txt'));
        var data = '';
        stream.on('data', function (chunk) {
            data += chunk;
        });

        stream.on('end', function () {
            expect(data).to.equal('Halló heimur!\n');
            done();
        });

        stream.on('error', done);
    });
});