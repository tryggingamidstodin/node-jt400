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

/**
 * Extracts the parts of a Java exception that identify a database error --
 * SQLSTATE, vendor error code and the exception class -- along with any
 * exceptions chained behind it. DB2 for i regularly puts the detail that
 * actually explains a failure in those chained exceptions rather than in the
 * first message.
 *
 * Returns undefined when there is nothing Java-shaped to report.
 */
function extractJavaCauseInfo(cause: any): any {
  if (!cause) {
    return undefined
  }
  const message = safeSyncCall(cause, 'getMessageSync')
  const sqlState = safeSyncCall(cause, 'getSQLStateSync')
  const errorCode = safeSyncCall(cause, 'getErrorCodeSync')

  let javaClass: string | undefined
  const cls = safeSyncCall(cause, 'getClassSync')
  if (cls) {
    const name = safeSyncCall(cls, 'getNameSync')
    if (typeof name === 'string') {
      javaClass = name
    }
  }

  const chained: any[] = []
  let next = safeSyncCall(cause, 'getNextExceptionSync')
  while (next && chained.length < MAX_CHAINED_EXCEPTIONS) {
    const link: any = {}
    const linkMessage = safeSyncCall(next, 'getMessageSync')
    const linkSqlState = safeSyncCall(next, 'getSQLStateSync')
    const linkErrorCode = safeSyncCall(next, 'getErrorCodeSync')
    if (linkMessage !== undefined) {
      link.message = linkMessage
    }
    if (linkSqlState !== undefined) {
      link.sqlState = linkSqlState
    }
    if (linkErrorCode !== undefined) {
      link.errorCode = linkErrorCode
    }
    if (Object.keys(link).length > 0) {
      chained.push(link)
    }
    next = safeSyncCall(next, 'getNextExceptionSync')
  }

  const info: any = {}
  if (message !== undefined) {
    info.message = message
  }
  if (sqlState !== undefined) {
    info.sqlState = sqlState
  }
  if (errorCode !== undefined) {
    info.errorCode = errorCode
  }
  if (javaClass !== undefined) {
    info.javaClass = javaClass
  }
  if (chained.length > 0) {
    info.chained = chained
  }
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
    const cause = extractJavaCauseInfo(err.cause) || extractJavaCauseInfo(err)
    throw new Oops({
      message,
      context: cause ? { ...context, cause } : context,
      category,
      cause: err,
    })
  }
}
