import { pool, Connection } from '..'
export const jt400: Connection = pool({
  'date format': 'iso',
})
