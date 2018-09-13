"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function recordToValues(record) {
    var str = Object.keys(record).map(function () {
        return '?';
    }).join(', ');
    return '(' + str + ')';
}
exports.toInsertSql = function (tableName, records) {
    var first = records[0], keys = Object.keys(first), sql = 'INSERT INTO ' +
        tableName +
        ' (' + keys.join(', ') +
        ') VALUES' +
        records.map(recordToValues).join(', ');
    return sql;
};
//# sourceMappingURL=sqlutil.js.map