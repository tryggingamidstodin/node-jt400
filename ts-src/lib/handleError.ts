import { Oops } from 'oops-error'

/** Guards against a chain of SQLExceptions that loops back on itself. */
const MAX_CHAINED_EXCEPTIONS = 5

/**
 * Calls a no-argument Java accessor over the JNI bridge, if it exists.
 *
 * Diagnostics are best effort: an error may be a plain JavaScript Error, a
 * java.sql.SQLException, or any other Throwable, and the bridge itself can
 * throw while crossing. Nothing here may turn a database error into a
 * different, more confusing one.
 */
function safeSyncCall(obj: any, method: string): any {
  try {
    if (obj && typeof obj[method] === 'function') {
      return obj[method]()
    }
  } catch {
    // Ignored on purpose, see above.
  }
  return undefined
}

/** Structured diagnostics of one java.sql.SQLException in a chain. */
export interface ChainedSqlError {
  message?: string
  sqlState?: string
  errorCode?: number
}

/**
 * Structured diagnostics of the SQL exception behind an error, available as
 * `context.sqlError` on the Oops. Fields the exception does not provide are
 * omitted.
 */
export interface SqlErrorInfo {
  sqlState?: string
  errorCode?: number
  chained?: ChainedSqlError[]
}

/** Calls a Java accessor and treats a Java null like a missing value. */
function readValue(obj: any, method: string): any {
  const value = safeSyncCall(obj, method)
  return value === null ? undefined : value
}

/** Copies the given entries, leaving out the ones without a value. */
function withoutMissing<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T
}

/**
 * Extracts the parts of a Java exception that identify a database error --
 * SQLSTATE, vendor error code and the exception class -- along with any
 * exceptions chained behind it. DB2 for i regularly puts the detail that
 * actually explains a failure in those chained exceptions rather than in the
 * first message.
 *
 * The message of the exception itself is not included, it is already the
 * message of the Oops.
 *
 * Returns undefined when the error is not a SQL exception, i.e. when it has
 * none of these.
 */
function extractSqlErrorInfo(javaError: any): SqlErrorInfo | undefined {
  if (!javaError) {
    return undefined
  }
  const chained: ChainedSqlError[] = []
  let next = readValue(javaError, 'getNextExceptionSync')
  for (let visited = 0; next && visited < MAX_CHAINED_EXCEPTIONS; visited++) {
    const link = withoutMissing<ChainedSqlError>({
      message: readValue(next, 'getMessageSync'),
      sqlState: readValue(next, 'getSQLStateSync'),
      errorCode: readValue(next, 'getErrorCodeSync'),
    })
    if (Object.keys(link).length > 0) {
      chained.push(link)
    }
    next = readValue(next, 'getNextExceptionSync')
  }

  const info = withoutMissing<SqlErrorInfo>({
    sqlState: readValue(javaError, 'getSQLStateSync'),
    errorCode: readValue(javaError, 'getErrorCodeSync'),
    chained: chained.length > 0 ? chained : undefined,
  })
  return Object.keys(info).length > 0 ? info : undefined
}

export function handleError(context: { [key: string]: any }) {
  return (err: any) => {
    const errMsg =
      (err.cause && err.cause.getMessageSync && err.cause.getMessageSync()) ||
      (err.getMessageSync && err.getMessageSync()) ||
      err.message
    const start = errMsg.indexOf(': ')
    const end = errMsg.indexOf('\n')
    const message = start > 0 && end > 0 ? errMsg.slice(start + 2, end) : errMsg
    const category =
      message.toLowerCase().includes('connection') ||
      errMsg.includes('java.net.UnknownHostException')
        ? 'OperationalError'
        : 'ProgrammerError'
    // The Java exception is either wrapped by the bridge or is the error
    // itself, matching how errMsg is resolved above.
    const sqlError = extractSqlErrorInfo(err.cause) || extractSqlErrorInfo(err)
    throw new Oops({
      message,
      context: sqlError ? { ...context, sqlError } : context,
      category,
      cause: err,
    })
  }
}
