'use strict';
var jt400 = require('../'),
    expect = require('chai').expect;

describe('keyed dataQ', function () {
    it('should read and write', function (done) {
        var dataQ = jt400.createKeyedDataQ({name: 'SDQS1'});

        dataQ.read('mytestkey').then(function (data) {
            expect(data).to.equal('ping');
        }).then(done, done);

        dataQ.write('mytestkey', 'ping');
    });

    it('should fail on timeout', function (done) {
        var dataQ = jt400.createKeyedDataQ({name: 'SDQS1'});
        dataQ.read({key: 'mytestkey', wait: 1 /*sec*/}).fail(function (err) {
            expect(err.message).to.contain('timeout, key: mytestkey');
        }).then(done, done);
    });
});