import { h as preactRender, Component } from 'preact'
import PropTypes from './prop-types-shim'
import autobind from 'autobind'
import { EventEmitter } from 'events'
import { platform } from 'os'
import CSS from './js-css'
import { Colors } from './colors'
import path from 'path'
import { fork, exec } from 'child_process'

global.isOsX = /^darwin/i.test(platform())
global.isWindows = /^win/i.test(platform())

global.CSS = CSS
global.Colors = Colors
global.PropTypes = {}
global.preactRender = preactRender
global.Component = Component
global.autobind = autobind

const oFetch = global.fetch
global.fetch = (url, options = {}) => {
  options = {
    ...options,
    headers: {
      ...options.headers,
      'x-vodo-no-record': 'true'
    }
  }
  return oFetch(url, options)
}

global.requireWindow = (Comp) => {
  Comp.contextTypes = {
    ...Comp.contextTypes,
    window: PropTypes.object,
    nativeWindow: PropTypes.object
  }
  return Comp
}

global.openUI = (page, options = {}, callback) => {
  const { props = {}, ...winOptions } = options
  winOptions.frame = false
  const htmlPath = 'app/assets/ui.html'
  nw.Window.open(htmlPath, winOptions, (win, ...args) => {
    win.window.document.addEventListener('DOMContentLoaded', () => {
      win.window.init(page, win, props)
    })
    callback && callback(win, ...args)
  })
}

global.eventBus = new EventEmitter()

eventBus.on('quit', () => {
  if (serviceProcess) {
    serviceProcess.kill('SIGKILL')
    eventBus.quit = true
  }
})


/**
 * Connect background proxy service
 */
global.serviceAddr = `http://127.0.0.1:${Store.config.port}`

eventBus.on('service:store', data => {
  eventBus.store = data
  eventBus.emit('store')
})
// if (typeof EventSource === 'undefined') {
//   class EventSource {
//     addEventListener (name, fn) {
//       fn({ data: JSON.stringify({ name }) })
//     }
//   }
//   global.EventSource = EventSource
// }

let serviceEv
let connDieTimeout
const connAlive = () => {
  if (connDieTimeout) {
    clearTimeout(connDieTimeout)
  }
  connDieTimeout = setTimeout(() => {
    connDieTimeout = null
    eventBus.connected = false
    eventBus.emit('connection')
    connectService()
  }, 6000).unref()
}

const connectService = () => {
  if (typeof EventSource === 'undefined') {
    return
  }
  if (serviceEv) {
    serviceEv.close()
  }
  serviceEv = new EventSource(`${global.serviceAddr}/live-sse`)
  ;['keepalive', 'store', 'begin', 'respond', 'finish', 'error'].forEach(eventName => {
    serviceEv.addEventListener(eventName, event => {
      eventBus.emit(`service:${eventName}`, JSON.parse(event.data))
      if (!eventBus.connected) {
        eventBus.connected = true
        eventBus.emit('connection')
      }
      connAlive()
    })
  })
}

let serviceProcess
const startService = () => {
  if (typeof EventSource === 'undefined') {
    return
  }
  const cp = fork(require.resolve('../index'), {
    env: { HEADLESS: '1', ...process.env }
  })
  serviceProcess = cp
  cp.on('message', function onMessage (msg) {
    if (msg.type === 'listening') {
      eventBus.hasServiceProcess = true
      eventBus.emit('connection')
      cp.removeListener('message', onMessage)
      global.serviceAddr = `http://127.0.0.1:${msg.port}`
      setTimeout(connectService, 2000).unref()
    }
  })
  const startTime = Date.now()
  cp.on('close', () => {
    if (eventBus.quit) {
      return
    }
    eventBus.hasServiceProcess = false
    eventBus.emit('connection')
    serviceProcess = null
    const upTime = Date.now() - startTime
    if (upTime < 10000) {
      if (!serviceEv) {
        connectService()
      }
      if (process.env.NODE_ENV !== 'dev') {
        setTimeout(startService, 5000).unref()
      }
    } else {
      setTimeout(startService, 1000).unref()
    }
  })
}
startService()

eventBus.on('change-service', (addr) => {
  if (/^http/.test(addr)) {
    global.serviceAddr = addr
    connectService()
  } else {
    Store.config.port = (addr | 0) || 8888
    if (serviceProcess) {
      serviceProcess.kill()
      setTimeout(() => {
        eventBus.hasServiceProcess = true
        eventBus.emit('connection')
      }, 200).unref()
    }
  }
})

/**
 * local proxy
 */
if (isOsX) {
  const parseKV = (content) => {
    const ret = {}
    content.split('\n').forEach(line => {
      const [k, v = ''] = line.split(':')
      ret[k.trim()] = v.trim()
    })
    return ret
  }
  let device = 'unknown'
  const poll = () => {
    const store = eventBus.store || {}
    const addr = store.addr
    const port = store.config && +store.config.port
    if (!addr || !port) {
      return
    }
    exec('networksetup -listallnetworkservices', (err, stdout) => {
      if (err) {
        return
      }
      const list = stdout.split('\n').slice(0).filter(v => !/\*/.test(v))
      let useLocalProxy = false
      let promise = Promise.resolve()
      list.forEach((network) => {
        promise = promise.then(() => new Promise((accept, reject) => {
          exec(`networksetup -getinfo ${network}`, (err, stdout) => {
            if (!err && parseKV(stdout)['IP address'] === addr) {
              device = network
              exec(`networksetup -getwebproxy ${network}`, (err, stdout) => {
                const info = parseKV(stdout || '')
                if (info['Enabled'] === 'Yes' && info['Server'] === '127.0.0.1' && +info['Port'] === port) {
                  useLocalProxy = true
                }
                accept()
              })
            } else {
              accept()
            }
          })
        }))
      })

      promise.then(() => {
        eventBus.useLocalProxy = useLocalProxy
        eventBus.emit('connection')
      })
    })
  }
  setInterval(poll, 5000).unref()
  eventBus.on('service:store', poll)
  eventBus.on('use-local-proxy', enable => {
    let cmd
    const store = eventBus.store
    const port = store.config && +store.config.port
    if (enable) {
      cmd = [
        `-setwebproxy ${device} 127.0.0.1 ${port}`,
        `-setwebproxystate ${device} on`,
        `-setsecurewebproxy ${device} 127.0.0.1 ${port}`,
        `-setsecurewebproxystate ${device} on`,
      ].map(cmd => `networksetup ${cmd}`).join(' && ')
    } else {
      cmd = [
        `-setwebproxystate ${device} off`,
        `-setsecurewebproxystate ${device} off`,
      ].map(cmd => `networksetup ${cmd}`).join(' && ')
    }
    cmd = `/usr/bin/osascript -e 'do shell script "${cmd}" with administrator privileges'`
    exec(cmd, (err, stdout, stderr) => {
      setTimeout(poll, 500).unref()
    })
  })
}

