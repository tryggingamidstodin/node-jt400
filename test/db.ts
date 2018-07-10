import { initialize, Connection } from '../lib/jt400'
export const jt400: Connection = initialize().pool({
    'date format': 'iso'
})