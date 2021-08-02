function recordToValues(record) {
  const str = Object.keys(record)
    .map(() => '?')
    .join(', ')
  return '(' + str + ')'
}

/**
 * Returns insert statement for records
 */
export function toInsertSql(tableName: string, records: any[]): string {
  const first = records[0]
  const keys = Object.keys(first)
  const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES${records
    .map(recordToValues)
    .join(', ')}`
  return sql
}
