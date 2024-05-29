import * as jvm from 'java'
//import { appendClasspath, ensureJvm, importClass } from 'java-bridge'
import { join as joinPath } from 'path'
import { promisify } from 'util'
import { JT400 } from './JT400'

export type BufferToJavaType = (buffer: Buffer) => any

export interface JavaBridge {
  createConnection: (config: string) => Promise<JT400>
  createPool: (config: string) => JT400
  createInMemoryConnection: () => JT400
  bufferToJavaType: BufferToJavaType
}

export const initJavaBridge = (): JavaBridge => {
  jvm.asyncOptions = {
    asyncSuffix: undefined,
    syncSuffix: 'Sync',
    promiseSuffix: '', // Generate methods returning promises, using the suffix Promise.
    promisify: promisify,
  }
  jvm.options.push('-Xrs') // fixing the signal handling issues (for exmaple ctrl-c)
  jvm.options.push('-Dcom.ibm.as400.access.AS400.guiAvailable=false') // Removes gui prompts

  const jars = [
    'jt400.jar',
    'jt400wrap.jar',
    'json-simple-1.1.1.jar',
    'hsqldb.jar',
  ]
  jars.map((jar) => {
    jvm.classpath.push(joinPath(__dirname, '/../../java/lib/', jar))
  })

  const JT400Class = jvm.import('nodejt400.JT400')
  return {
    createConnection: (config: string) => JT400Class.createConnection(config),
    createInMemoryConnection: () => {
      const HsqlClientClass = jvm.import('nodejt400.HsqlClient')
      const instance: any = new HsqlClientClass()
      return instance
    },
    createPool: (config: string) => JT400Class.createPoolSync(config),
    bufferToJavaType: (buffer: Buffer) => {
      const byteArray = jvm.newArray('byte', [...buffer])
      return byteArray
    },
  }
}

// export const initNewJavaBridge = (): JavaBridge => {
//   ensureJvm({
//     // This option should not have any effect when not using electron or not having the application packaged.
//     // https://github.com/MarkusJx/node-java-bridge?tab=readme-ov-file#notes-on-electron
//     isPackagedElectron: true,

//     opts: [
//       '-Xrs',
//       '-Dcom.ibm.as400.access.AS400.guiAvailable=false', // Removes gui prompts
//     ],
//   })
//   appendClasspath(
//     ['jt400.jar', 'jt400wrap.jar', 'json-simple-1.1.1.jar', 'hsqldb.jar'].map(
//       (jar) => joinPath(__dirname, '/../../java/lib/', jar)
//     )
//   )

//   const JT400Class = importClass('nodejt400.JT400')
//   return {
//     createConnection: (config: string) => JT400Class.createConnection(config),
//     createInMemoryConnection: () => {
//       const HsqlClientClass = importClass('nodejt400.HsqlClient')
//       const instance: any = new HsqlClientClass()
//       return instance
//     },
//     createPool: (config: string) => JT400Class.createPoolSync(config),
//     bufferToJavaType: (buffer: Buffer) => buffer,
//   }
// }
