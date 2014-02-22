'use strict';
var util = require('util'),
	Q = require('q'),
	Readable = require('stream').Readable;


function JdbcStream (opt) {
	Readable.call(this, {objectMode: false});
	this._jdbcStream = opt.jdbcStream;
	this._buffer = [];
}

util.inherits(JdbcStream, Readable);

JdbcStream.prototype.close = function () {
	this._closed = true;
};

JdbcStream.prototype._read = function () {
	var _this = this;
	if(this._closed) {
		this._jdbcStream.close(function (err) {
			if(err) {
				console.log('close error', err);
			}
		});
		this.push(null);
	} else {
		this._jdbcStream.read(function (err, res) {
			if(err) {
				_this.emit('error', err);
			} else {
				_this.push(res);
			}
		});
	}
};

module.exports = JdbcStream;