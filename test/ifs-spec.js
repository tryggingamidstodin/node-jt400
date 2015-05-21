'use strict';
var jt400 = require('../lib/jt400').pool(),
    expect = require('chai').expect,
    q = require('q');

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