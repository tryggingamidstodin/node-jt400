'use strict';
var util = require('util'),
	Q = require('q'),
	Readable = require('stream').Readable;


function JdbcStream (opt) {
	Readable.call(this, {objectMode: true});
	this._jdbcStream = opt.jdbcStream;
	this._buffer = [];
}

util.inherits(JdbcStream, Readable);

JdbcStream.prototype.getMetaData = function () {
	return Q.nfcall(this._jdbcStream.getMetaData.bind(this._jdbcStream)).then(JSON.parse);
};

JdbcStream.prototype.close = function () {
	this._jdbcStream.close();
	this._closed = true;
};

JdbcStream.prototype._read = function () {
	var _this = this;
	if(this._closed) {
		this.push(null);
	} else if(this._buffer.length>0) {
		var row = _this._buffer.splice(0,1)[0];
		_this.push(row);
	} else {
		this._jdbcStream.read(function (err, res) {
			if(err) {
				_this.emit('error', err);
			} else if(res) {
				_this._buffer = JSON.parse(res);
				_this.push(_this._buffer.splice(0,1)[0]);
			} else {
				_this.push(null);
			}
		});
	}
};

module.exports = JdbcStream;