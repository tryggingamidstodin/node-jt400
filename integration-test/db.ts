import { pool, Connection } from '../lib/jt400'
export const jt400: Connection = pool({
  'date format': 'iso',
})
