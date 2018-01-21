import PropTypes from 'prop-types'
import React from 'react'
import autobind from 'autobind'
import { platform } from 'os'
import CSS from './js-css'
import { Colors } from './colors'

global.isWindows = /win/.test(platform())
global.CSS = CSS
global.Colors = Colors
global.PropTypes = PropTypes
global.React = React
global.Component = React.Component
global.requireWindow = (Comp) => {
  Comp.contextTypes = Object.assign({}, Comp.contextTypes || {}, {
    window: PropTypes.object,
    nativeWindow: PropTypes.object
  })
  return Comp
}
global.autobind = autobind

global.openUI = (page, options, callback) => {
  nw.Window.open('../assets/ui.html', options, (win, ...args) => {
    win.window.document.addEventListener('DOMContentLoaded', () => {
      win.window.init(page, win)
    })
    callback && callback(win, ...args)
  })
}

if (typeof nw !== 'undefined') {
  openUI('main', { frame: false })
}
