
function recordToValues(record) {
	var str = Object.keys(record).map(function () {
			return '?';
		}).join(', ');
	return '('+ str + ')';
}

/**
 * Returns insert statement for records
 */
export const toInsertSql = function (tableName: string, records: any[]): string {
	var first = records[0],
		keys = Object.keys(first),
		sql = 'INSERT INTO ' +
				tableName +
				' (' + keys.join(', ') +
				') VALUES' +
				records.map(recordToValues).join(', ');
	return sql;
}
