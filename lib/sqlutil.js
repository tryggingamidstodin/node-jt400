'use strict';
var _ = require('underscore');

function recordToValues(record) {
	var str = _.map(_.values(record), function (value) {
			return '?';
		}).join(', ');
	return '('+ str + ')';
}

module.exports = {
	/**
	 * Returns insert statement for records
	 * @param  {String} tableName
	 * @param  {Array} records
	 * @return {String} insert statement
	 */
	toInsertSql: function (tableName, records) {
		var first = _.first(records),
			keys = _.keys(first),
			sql = 'INSERT INTO ' +
				  tableName +
				  ' (' + keys.join(', ') +
				  ') VALUES' +
				  _.map(records, recordToValues).join(', ');
		return sql;
	}
};