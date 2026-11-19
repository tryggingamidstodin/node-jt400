import assert from 'assert'
import { describe, it } from 'node:test'
import { BaseConnection, Connection, pool } from '../index.js'
import { jt400 as admin } from './db.js'

// Simulates the IBM i dropping a connection while it sits idle in the pool by
// ending the server job of that connection. Needs authority to end the
// caller's own QZDASOINIT jobs, which a normal user has.

const jobNameSql = 'select qsys2.job_name as JOB from sysibm.sysdummy1'

async function jobName(db: BaseConnection): Promise<string> {
  const [row] = await db.query<{ JOB: string }>(jobNameSql)
  return row.JOB.trim()
}

async function endJob(job: string) {
  assert.ok(job.includes('QZDASOINIT'), `unexpected job ${job}`)
  await admin.execute(`call qsys2.qcmdexc('ENDJOB JOB(${job}) OPTION(*IMMED)')`)
  // let the server finish ending the job and the client see the socket close
  await new Promise((resolve) => setTimeout(resolve, 500))
}

// Gives the pool an idle connection and kills it on the server.
async function poolWithDeadConnection(): Promise<{
  db: Connection
  deadJob: string
}> {
  const db = pool({ 'date format': 'iso' })
  const deadJob = await jobName(db)
  await endJob(deadJob)
  return { db, deadJob }
}

describe(
  'dead pooled connection',
  { timeout: 60000, concurrency: true },
  () => {
    it('query gets a new connection', async () => {
      const { db, deadJob } = await poolWithDeadConnection()
      try {
        const job = await jobName(db)
        assert.notStrictEqual(job, deadJob)
      } finally {
        db.close()
      }
    })

    it('update gets a new connection', async () => {
      const { db } = await poolWithDeadConnection()
      try {
        const updated = await db.update('delete from tsttbl where 1 = 0')
        assert.strictEqual(updated, 0)
      } finally {
        db.close()
      }
    })

    it('read stream gets a new connection', async () => {
      const { db } = await poolWithDeadConnection()
      try {
        const rows: unknown[] = []
        for await (const chunk of db.createReadStream(jobNameSql)) {
          rows.push(chunk)
        }
        assert.ok(rows.length > 0)
      } finally {
        db.close()
      }
    })

    it('transaction gets a new connection', async () => {
      const { db, deadJob } = await poolWithDeadConnection()
      try {
        const transaction = await db.transaction(async (tx) => {
          return jobName(tx)
        })
        assert.notStrictEqual(transaction, deadJob)
      } finally {
        db.close()
      }
    })

    it('skips several dead connections in the pool', async () => {
      const db = pool({ 'date format': 'iso' })
      try {
        const jobs = new Set(
          await Promise.all([1, 2, 3, 4].map(() => jobName(db))),
        )
        for (const job of jobs) {
          await admin.execute(
            `call qsys2.qcmdexc('ENDJOB JOB(${job}) OPTION(*IMMED)')`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
        const job = await jobName(db)
        assert.ok(!jobs.has(job), 'should not reuse a dead connection')
      } finally {
        db.close()
      }
    })

    it('does not hide errors that are not connection errors', async () => {
      const db = pool({ 'date format': 'iso' })
      try {
        await assert.rejects(
          db.query('select * from table_that_does_not_exist'),
        )
      } finally {
        db.close()
      }
    })
  },
)
