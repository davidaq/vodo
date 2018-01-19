import 'colors'
import CSS from './js-css'

global.CSS = CSS

global.openUI = (page, options, callback) => {
  nw.Window.open('../assets/ui.html', options, (win, ...args) => {
    win.window.document.addEventListener('DOMContentLoaded', () => {
      win.window.init(page)
      const inject = `
        <script>
        const RootComp = require('../gui/pages/${page}');
        </script>
      `
      win.window.document.body.innerHTML += inject
    })
    callback && callback(win, ...args)
  })
}

openUI('main', { frame: false })

