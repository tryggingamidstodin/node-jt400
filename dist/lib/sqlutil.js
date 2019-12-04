"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function recordToValues(record) {
    const str = Object.keys(record)
        .map(() => '?')
        .join(', ');
    return '(' + str + ')';
}
function toInsertSql(tableName, records) {
    const first = records[0];
    const keys = Object.keys(first);
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES${records.map(recordToValues).join(', ')}`;
    return sql;
}
exports.toInsertSql = toInsertSql;
//# sourceMappingURL=sqlutil.js.map