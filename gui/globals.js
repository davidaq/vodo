import PropTypes from 'prop-types'
import React from 'react'
import autobind from 'autobind'
import { EventEmitter } from 'events'
import { platform } from 'os'
import CSS from './js-css'
import { Colors } from './colors'

global.isWindows = /win/.test(platform())

global.CSS = CSS
global.Colors = Colors
global.PropTypes = PropTypes
global.React = React
global.Component = React.Component
global.autobind = autobind
global.serviceAddr = `http://127.0.0.1:${Store.config.port}`
global.serviceEv = new EventSource(`${global.serviceAddr}/live-sse`)
global.storeEv = new EventEmitter()
serviceEv.addEventListener('store', event => {
  storeEv.value = JSON.parse(event.data)
  storeEv.emit('store')
})

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
  nw.Window.open('../assets/ui.html', winOptions, (win, ...args) => {
    win.window.document.addEventListener('DOMContentLoaded', () => {
      win.window.init(page, win, props)
    })
    callback && callback(win, ...args)
  })
}
