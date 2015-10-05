'use strict';
var util = require('util'),
	Readable = require('stream').Readable;


function JdbcStream (opt) {
	Readable.call(this, {objectMode: false});
	this._jdbcStream = opt.jdbcStream;
	this._jdbcStreamPromise = opt.jdbcStreamPromise;
}

util.inherits(JdbcStream, Readable);

function read(context) {
	if(context._closed) {
		context._jdbcStream.close(function (err) {
			if(err) {
				console.log('close error', err);
			}
		});
		context.push(null);
	} else {
		context._jdbcStream.read(function (err, res) {
			if(err) {
				context.emit('error', err);
			} else {
				context.push(res);
			}
		});
	}
}

JdbcStream.prototype.close = function () {
	this._closed = true;
};

JdbcStream.prototype._read = function () {
	var _this = this;
	if(!this._jdbcStream) {
		this._jdbcStreamPromise.then(function(stream) {
		    _this._jdbcStream = stream;
			read(_this);
		}).fail(function(err) {
		    _this.emit('error', err);
		});
	} else {
		read(this);
	}
};

module.exports = JdbcStream;
