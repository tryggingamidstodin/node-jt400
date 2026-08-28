import assert from 'assert'
import { handleError } from '../lib/handleError.js'

/**
 * Stand-in for a java.sql.SQLException as it arrives over the JNI bridge:
 * a JavaScript object carrying the synchronous accessors of the Java
 * object. No JVM is involved, so these run anywhere.
 */
function javaSqlException(opt: {
  message?: string
  sqlState?: string
  errorCode?: number
  className?: string
  next?: any
}) {
  return {
    getMessageSync: () => opt.message,
    getSQLStateSync: () => opt.sqlState,
    getErrorCodeSync: () => opt.errorCode,
    getClassSync: () =>
      opt.className ? { getNameSync: () => opt.className } : undefined,
    getNextExceptionSync: () => opt.next,
  }
}

function captureOops(err: any, context: any = { sql: 'select 1 from x' }) {
  try {
    handleError(context)(err)
  } catch (oops) {
    return oops as any
  }
  throw new Error('handleError did not throw')
}

describe('handleError', () => {
  it('should keep message and category for a plain error', () => {
    const oops = captureOops(new Error('something went wrong'))

    assert.strictEqual(oops.message, 'something went wrong')
    assert.strictEqual(oops.category, 'ProgrammerError')
  })

  it('should keep slicing the message of a wrapped java exception', () => {
    const oops = captureOops({
      cause: javaSqlException({
        message: 'java.sql.SQLException: Column not found: NOPE\n\tat com.ibm',
      }),
    })

    assert.strictEqual(oops.message, 'Column not found: NOPE')
    assert.strictEqual(oops.category, 'ProgrammerError')
  })

  it('should keep categorising connection failures as operational', () => {
    const oops = captureOops({
      cause: javaSqlException({
        message: 'java.sql.SQLException: The connection does not exist.\n\tat',
      }),
    })

    assert.strictEqual(oops.category, 'OperationalError')
  })

  it('should keep categorising unknown hosts as operational', () => {
    const oops = captureOops(
      new Error('boom: java.net.UnknownHostException\nat somewhere'),
    )

    assert.strictEqual(oops.category, 'OperationalError')
  })

  it('should add sqlState, errorCode and class to the context', () => {
    const oops = captureOops({
      cause: javaSqlException({
        message: 'java.sql.SQLException: Column not found: NOPE\n\tat com.ibm',
        sqlState: '42703',
        errorCode: -206,
        className: 'com.ibm.as400.access.AS400JDBCSQLSyntaxErrorException',
      }),
    })

    assert.deepStrictEqual(oops.context.cause, {
      message: 'java.sql.SQLException: Column not found: NOPE\n\tat com.ibm',
      sqlState: '42703',
      errorCode: -206,
      javaClass: 'com.ibm.as400.access.AS400JDBCSQLSyntaxErrorException',
    })
    // The caller's own context is preserved alongside it.
    assert.strictEqual(oops.context.sql, 'select 1 from x')
  })

  it('should collect chained exceptions', () => {
    const oops = captureOops({
      cause: javaSqlException({
        message: 'first\nline',
        sqlState: '23505',
        next: javaSqlException({
          message: 'second',
          sqlState: '42703',
          errorCode: -206,
          next: javaSqlException({ message: 'third', sqlState: '22001' }),
        }),
      }),
    })

    assert.deepStrictEqual(oops.context.cause.chained, [
      { message: 'second', sqlState: '42703', errorCode: -206 },
      { message: 'third', sqlState: '22001' },
    ])
  })

  it('should not loop forever on a self-referential chain', () => {
    const looping: any = javaSqlException({ message: 'loop', sqlState: '5800' })
    looping.getNextExceptionSync = () => looping

    const oops = captureOops({ cause: looping })

    assert.strictEqual(oops.context.cause.chained.length, 5)
  })

  it('should read diagnostics when the error itself is the java exception', () => {
    const oops = captureOops(
      javaSqlException({
        message: 'java.sql.SQLException: Row not found\n\tat com.ibm',
        sqlState: '02000',
      }),
    )

    assert.strictEqual(oops.context.cause.sqlState, '02000')
  })

  it('should leave the context untouched when there is nothing java-shaped', () => {
    const oops = captureOops(new Error('plain failure'), { sql: 'select 1' })

    assert.deepStrictEqual(oops.context, { sql: 'select 1' })
  })

  it('should not fail when the java accessors throw', () => {
    const hostile = {
      getMessageSync: () => 'java.sql.SQLException: broken\n\tat com.ibm',
      getSQLStateSync: () => {
        throw new Error('bridge failure')
      },
      getErrorCodeSync: () => {
        throw new Error('bridge failure')
      },
      getClassSync: () => {
        throw new Error('bridge failure')
      },
      getNextExceptionSync: () => {
        throw new Error('bridge failure')
      },
    }

    const oops = captureOops({ cause: hostile })

    assert.strictEqual(oops.message, 'broken')
    assert.deepStrictEqual(oops.context.cause, {
      message: 'java.sql.SQLException: broken\n\tat com.ibm',
    })
  })
})
