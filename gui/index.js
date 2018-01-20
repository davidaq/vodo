import CSS from './js-css'
import { Colors } from './colors'

global.CSS = CSS
global.Colors = Colors

global.openUI = (page, options, callback) => {
  nw.Window.open('../assets/ui.html', options, (win, ...args) => {
    win.window.document.addEventListener('DOMContentLoaded', () => {
      win.window.init(page)
    })
    callback && callback(win, ...args)
  })
}

if (typeof nw !== 'undefined') {
  openUI('main', { frame: false })
}
