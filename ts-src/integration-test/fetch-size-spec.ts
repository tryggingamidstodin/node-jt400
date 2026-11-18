import assert from 'assert'
import { describe, it, after } from 'node:test'
import { pipeline } from 'stream/promises'
import { pool, Connection, parseJsonArray } from '../index.js'

/**
 * Measures whether the optional 'fetch size' connection property (and, for
 * comparison, the Toolbox driver's own 'block size') changes how long it
 * takes to read a large result set. Run against a real IBM i.
 *
 * Setting 'fetch size' also sets 'block size' to '0', which the driver
 * requires before it uses the fetch size, see the comment on the variants
 * below.
 *
 * The measurements take minutes, far over the 20s file timeout of
 * `npm run integration-test`, so they only run when FETCH_SIZE_MEASURE is set
 * and the file timeout is lifted:
 *
 *   FETCH_SIZE_MEASURE=1 FETCH_SIZE_ROWS=200000 FETCH_SIZE_RUNS=5 \
 *     node --test --test-force-exit --test-timeout=0 \
 *     dist-esm/integration-test/fetch-size-spec.js
 *
 * Timings are printed, never asserted: they depend on the network and the
 * system. The assertions only check that every variant returns the same data.
 */
const ROWS = parseInt(process.env.FETCH_SIZE_ROWS ?? '', 10) || 100000
const RUNS = parseInt(process.env.FETCH_SIZE_RUNS ?? '', 10) || 3

// Generates the given number of rows without needing a test table.
const generateRows = (rows: number) => `
  with t(n) as (
    select 1 from sysibm.sysdummy1
    union all
    select n + 1 from t where n < ${rows}
  )
  select n, 'row number ' concat char(n) as label, repeat('x', 100) as pad
  from t`

const sql = generateRows(ROWS)

// Small enough for the 20s file timeout of `npm run integration-test`, large
// enough to need several fetches with the fetch size used below.
const VALIDATION_ROWS = 200
const validationSql = `${generateRows(VALIDATION_ROWS)} order by n`

type Variant = { name: string; config: Record<string, unknown> }

// The Toolbox driver only honours the fetch size when 'block size' is 0;
// otherwise it derives the number of rows per fetch from the block size
// (default 32) and ignores the fetch size. Setting 'fetch size' therefore
// sets 'block size' to '0' unless the config sets a block size itself, so
// 'block size 512 + fetch size 5000' is expected to perform like
// 'block size 512'.
//
// Config values reach the driver as strings whatever their JSON type, so
// 'block size' is given once as a number and once as a string on purpose.
const variants: Variant[] = [
  { name: 'driver defaults', config: {} },
  { name: 'fetch size 100', config: { 'fetch size': 100 } },
  { name: 'fetch size 500', config: { 'fetch size': 500 } },
  { name: 'fetch size 5000', config: { 'fetch size': 5000 } },
  { name: 'fetch size 30000', config: { 'fetch size': 30000 } },
  { name: 'block size 512', config: { 'block size': 512 } },
  {
    name: 'block size 512 + fetch size 5000',
    config: { 'block size': '512', 'fetch size': 5000 },
  },
]

const base = { 'date format': 'iso' }

// Rows returned by the first variant (driver defaults). Every other variant
// must return exactly the same data.
let baseline: unknown[] | undefined
const open: Connection[] = []

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function time<T>(fn: () => Promise<T>) {
  const start = process.hrtime.bigint()
  const result = await fn()
  return { result, seconds: Number(process.hrtime.bigint() - start) / 1e9 }
}

async function countStream(db: Connection) {
  let rows = 0
  await pipeline(db.createReadStream(sql), parseJsonArray(), async (parsed) => {
    for await (const _row of parsed) rows++
  })
  return rows
}

describe('fetch size', () => {
  after(() => {
    open.forEach((db) => db.close())
  })

  describe('measurements', { skip: !process.env.FETCH_SIZE_MEASURE }, () => {
    for (const variant of variants) {
      it(
        `${variant.name}: query and stream ${ROWS} rows`,
        { timeout: 10 * 60 * 1000 },
        async () => {
          const db = pool({ ...base, ...variant.config })
          open.push(db)

          const queryTimes: number[] = []
          const streamTimes: number[] = []
          for (let i = 0; i < RUNS; i++) {
            const q = await time(() => db.query(sql))
            assert.strictEqual(q.result.length, ROWS)
            baseline ??= q.result
            assert.deepStrictEqual(q.result, baseline)
            queryTimes.push(q.seconds)

            const s = await time(() => countStream(db))
            assert.strictEqual(s.result, ROWS)
            streamTimes.push(s.seconds)
          }
          console.log(
            `fetch-size | ${variant.name.padEnd(34)} | ` +
              `query median ${median(queryTimes).toFixed(2)}s | ` +
              `stream median ${median(streamTimes).toFixed(2)}s | ` +
              `${ROWS} rows, ${RUNS} runs`,
          )
        },
      )
    }
  })

  describe('validation', () => {
    it('rejects a non-numeric fetch size', () => {
      assert.throws(
        () => pool({ ...base, 'fetch size': 'lots' }),
        /NumberFormatException/,
      )
    })

    it('returns identical rows with and without a fetch size', async () => {
      const plain = pool(base)
      const tuned = pool({ ...base, 'fetch size': 50 })
      open.push(plain, tuned)
      const expected = await plain.query(validationSql)
      assert.strictEqual(expected.length, VALIDATION_ROWS)
      assert.deepStrictEqual(await tuned.query(validationSql), expected)
    })
  })
})
