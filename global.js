import { readFileSync, writeFile, mkdir } from 'fs'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { fork } from 'child_process'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"


global.readAssets = name => readFileSync(join(__dirname, 'assets', name))

global.EventBus = {

}
new EventEmitter()
global.EventBus.emit

const childProcess = []
global.fork = env => {
  const proc = fork(require.resolve('./index'), [], {
    env: Object.assign({ FORKED: '1' }, process.env, env)
  })
  childProcess.push(proc)
  proc.on('close', () => {
    childProcess.splice(childProcess.indexOf(proc), 1)
  })
  proc.on('message', msg => {
    if (msg.type === 'STORE_CHANGE') {
      if (process.env.FORKED) {
        process.send({ type: msg.type, value: msg.value })
      } else {
        propagateStore(msg.value)
      }
    }
  })
  return proc
}

process.on('message', msg => {
  if (msg.type === 'STORE_SYNC') {
    propagateStore(msg.value)
  }
})

const initStoreData = JSON.parse(readAssets('app-data.json'))
try {
  Object.assign(initStoreData, JSON.parse(readFileSync(join(homedir(), '.zokor', 'app-data.json'))))
} catch (err) {
}
global.Store = createBoundObj(initStoreData || {})

function propagateStore (value, keepCurrent = false) {
  if (!keepCurrent) {
    global.Store = createBoundObj(JSON.parse(value))
  }
  childProcess.forEach(proc => {
    proc.send({ type: 'STORE_SYNC', value })
  })
  if (!process.env.FORKED) {
    mkdir(join(homedir(), '.zokor'), () => {
      writeFile(join(homedir(), '.zokor', 'app-data.json'), value, err => null)
    })
  }
}


let storeSyncTimeout

function createBoundObj (value, noCopy = false) {
  if (!noCopy && value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value = value.map(item => createBoundObj(item))
    } else {
      const clone = createBoundObj({}, true)
      Object.keys(value).forEach(key => {
        clone[key] = createBoundObj(value[key])
      })
      value = clone
    }
  } else {
    return value
  }
  return new Proxy(value, {
    set (target, key, value) {
      value = createBoundObj(value)
      target[key] = value
      if (!storeSyncTimeout) {
        storeSyncTimeout = setTimeout(() => {
          storeSyncTimeout = 0
          const value = JSON.stringify(global.Store)
          if (process.env.FORKED) {
            process.send({ type: 'STORE_CHANGE', value })
          } else {
            propagateStore(value, true)
          }
        }, 100)
      }
      return value
    }
  })
}

