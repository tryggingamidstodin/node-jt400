'use strict';
var jt400 = require('../').pool(),
    expect = require('chai').expect;

describe('keyed dataQ', function () {
    it('should read and write', function (done) {
        this.timeout(5000);
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

    it('should write to reponse', function() {
        var dataQ = jt400.createKeyedDataQ({name: 'SDQS1'});
        dataQ.read({key: 'mytestkey', wait: 1, writeKeyLength: 11}).then(function(res) {
            expect(res.data).to.equal('ping');
            res.write('pong');
        });

        dataQ.write('mytestkey', 'returnkey  ping');

        return dataQ.read({key: 'returnkey  ', wait: 10}).then(function(data) {
            expect(data).to.equal('pong');
        });
    });
});
