import { fork } from 'child_process'
import { EventEmitter } from 'events'

if (process.env.FORKED) {
  setTimeout(() => {
    process.send({ type: 'PROCESS_STARTED' })
  }, 50)
  const handlers = {}
  const waiters = {}
  class IPC extends EventEmitter {
    constructor () {
      super()
      this.isMain = false
      process.on('message', msg => {
        switch (msg.type) {
        case 'EVENT':
          super.emit(msg.eventName, ...msg.args)
          break
        case 'REQUEST':
          if (handlers[msg.uri]) {
            Promise.resolve(handlers[msg.uri](...msg.args))
            .then(result => {
              process.send({ type: 'ANSWER', hash: msg.hash, result })
            }, error => {
              process.send({ type: 'ANSWER', hash: msg.hash, error })
            })
          } else {
            process.send({ type: 'ANSWER', hash: msg.hash, error: { message: 'No handler' } })
          }
          break
        case 'ANSWER':
          if (waiters[msg.hash]) {
            const { hash, result, error } = msg
            const { resolve, reject } = waiters[hash]
            if (error) {
              reject(error)
            } else {
              resolve(result)
            }
          }
          break
        }
      })
    }
    start (env) {
      process.send({ type: 'FORK', env })
    }
    emit (eventName, ...args) {
      process.send({ type: 'EVENT', eventName, args })
    }
    request (uri, ...args) {
      const hash = ID()
      const ret = new Promise((resolve, reject) => {
        waiters[hash] = { resolve, reject }
      })
      process.send({ type: 'REQUEST', hash, uri, args })
      return ret
    }
    answer (uri, handler) {
      handlers[uri] = handler
      process.send({ type: 'ANSWERER', uri })
    }
  }
  global.IPC = new IPC()
} else {
  const childProcess = []
  let processSpawning = 0
  
  const answerers = {}
  function getAnswerers (uri) {
    if (!answerers[uri]) {
      answerers[uri] = {
        handlers: [],
        queue: [],
        robin: 0,
        handle () {
          if (this.queue.length === 0 || this.handlers.length === 0) {
            return
          }
          const job = this.queue.shift()
          const handler = this.handlers[this.robin]
          this.robin = (this.robin + 1) % this.handlers.length
          handler(...job.args).then(job.resolve, job.reject)
          if (this.queue.length > 0) {
            setTimeout(() => {
              this.handle()
            }, 50)
          }
        }
      }
    }
    return answerers[uri]
  }
  class IPC extends EventEmitter {
    constructor () {
      super()
      this.isMain = true
    }
    start (env) {
      const proc = fork(require.resolve('../index'), [], {
        env: Object.assign({ FORKED: '1' }, process.env, env || {})
      })
      processSpawning++
      let ready = false
      proc.on('close', () => {
        if (ready) {
          childProcess.splice(childProcess.indexOf(proc), 1)
        } else {
          processSpawning--
        }
      })
      const waiters = {}
      proc.on('message', msg => {
        switch (msg.type) {
        case 'PROCESS_STARTED':
          ready = true
          processSpawning--
          childProcess.push(proc)
          break
        case 'FORK':
          this.start(msg.env)
          break
        case 'EVENT':
          this.emit(msg.eventName, ...msg.args)
          break
        case 'REQUEST':
          this.request(msg.uri, ...msg.args)
          .then(result => {
            proc.send({ type: 'ANSWER', hash: msg.hash, result })
          }, error => {
            proc.send({ type: 'ANSWER', hash: msg.hash, error })
          })
          break
        case 'ANSWERER': 
          this.answer(msg.uri, (...args) => {
            const hash = ID()
            const ret = new Promise((resolve, reject) => {
              waiters[hash] = { resolve, reject }
            })
            proc.send({ type: 'REQUEST', uri: msg.uri, hash, args })
            return ret
          })
          break
        case 'ANSWER':
          if (waiters[msg.hash]) {
            const { hash, result, error } = msg
            const { resolve, reject } = waiters[hash]
            if (error) {
              reject(error)
            } else {
              resolve(result)
            }
          }
          break
        }
      })
    }
    emit (eventName, ...args) {
      if (processSpawning > 0) {
        setTimeout(() => {
          this.emit(eventName, ...args)
        }, 50)
      } else {
        super.emit(eventName, ...args)
        childProcess.forEach(proc => {
          proc.send({ type: 'EVENT', eventName, args })
        })
      }
    }
    request (uri, ...args) {
      return new Promise((resolve, reject) => {
        const answerers = getAnswerers(uri)
        const hash = ID()
        answerers.queue.push({ hash, args, resolve, reject })
        answerers.handle()
      })
    }
    answer (uri, handler) {
      const answerers = getAnswerers(uri)
      answerers.handlers.push(handler)
      answerers.handle()
    }
  }
  global.IPC = new IPC()
}
