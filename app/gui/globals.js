import React, { PropTypes } from 'preact-compat'
import autobind from 'autobind'
import { EventEmitter } from 'events'
import { platform } from 'os'
import CSS from './js-css'
import { Colors } from './colors'
import path from 'path'
import { fork } from 'child_process'

global.isOsX = /^darwin/i.test(platform())
global.isWindows = /^win/i.test(platform())

global.CSS = CSS
global.Colors = Colors
global.PropTypes = PropTypes
global.React = React
global.Component = React.Component
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
global.serviceAddr = `http://127.0.0.1:${Store.config.port}`

global.eventBus.on('service:store', data => {
  global.eventBus.store = data
  global.eventBus.emit('store')
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
    global.eventBus.connected = false
    global.eventBus.emit('connection')
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
      global.eventBus.emit(`service:${eventName}`, JSON.parse(event.data))
      if (!global.eventBus.connected) {
        global.eventBus.connected = true
        global.eventBus.emit('connection')
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
      global.eventBus.hasServiceProcess = true
      global.eventBus.emit('connection')
      cp.removeListener('message', onMessage)
      global.serviceAddr = `http://127.0.0.1:${msg.port}`
      setTimeout(connectService, 2000).unref()
    }
  })
  const startTime = Date.now()
  cp.on('close', () => {
    global.eventBus.hasServiceProcess = false
    global.eventBus.emit('connection')
    serviceProcess = null
    const upTime = Date.now() - startTime
    if (upTime < 10000) {
      if (!serviceEv) {
        connectService()
      }
      setTimeout(startService, 5000).unref()
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
        global.eventBus.hasServiceProcess = true
        global.eventBus.emit('connection')
      }, 200).unref()
    }
  }
})

eventBus.on('quit', () => {
  if (serviceProcess) {
    serviceProcess.kill()
  }
})

