'use strict';

function recordToValues(record) {
	var str = Object.keys(record).map(function () {
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
		var first = records[0],
			keys = Object.keys(first),
			sql = 'INSERT INTO ' +
				  tableName +
				  ' (' + keys.join(', ') +
				  ') VALUES' +
				  records.map(recordToValues).join(', ');
		return sql;
	}
};
