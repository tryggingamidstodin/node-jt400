import { Oops } from 'oops-error'

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
    throw new Oops({
      message,
      context,
      category,
      cause: err,
    })
  }
}
