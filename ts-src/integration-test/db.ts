import { Connection, pool } from '..'

export const jt400: Connection = pool({
  'date format': 'iso',
})
