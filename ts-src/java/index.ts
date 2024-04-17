import { appendClasspath, ensureJvm, importClass } from 'java-bridge'
import { join as joinPath } from 'path'
import { JT400 } from './JT400'

export interface JT400Factory {
  createConnection: (config: string) => Promise<JT400>
  createPool: (config: string) => JT400
  createInMemoryConnection: () => JT400
}

export const initJT400Factory = (): JT400Factory => {
  ensureJvm({
    opts: [
      '-Xrs',
      '-Dcom.ibm.as400.access.AS400.guiAvailable=false', // Removes gui prompts
    ],
  })
  appendClasspath(
    ['jt400.jar', 'jt400wrap.jar', 'json-simple-1.1.1.jar', 'hsqldb.jar'].map(
      (jar) => joinPath(__dirname, '/../../java/lib/', jar)
    )
  )

  const JT400Class = importClass('nodejt400.JT400')
  return {
    createConnection: (config: string) => JT400Class.createConnection(config),
    createInMemoryConnection: () => {
      const HsqlClientClass = importClass('nodejt400.HsqlClient')
      const instance: any = new HsqlClientClass()
      return instance
    },
    createPool: (config: string) => JT400Class.createPoolSync(config),
  }
}
