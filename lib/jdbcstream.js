'use strict';
var util = require('util'),
	Readable = require('stream').Readable;


function JdbcStream (opt) {
	Readable.call(this, opt);
	this._jdbcStream = opt.jdbcStream;
}

util.inherits(JdbcStream, Readable);

JdbcStream.prototype._read = function () {
	var _this = this;
	this._jdbcStream.read(function (err, res) {
		if(err) {
			_this.emit('error', err);
			return;
		}
		_this.push(res);
	});
};

module.exports = JdbcStream;