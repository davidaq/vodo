const Module = require('module')
const fs = require('fs')
const vueParser = require('vue-loader/lib/parser')

const origLoad = Module._load

Module._load = function (request, parent, isMain) {
  if (/\.vue$/i.test(request)) {
    const filename = Module._resolveFilename(request, parent)
    const content = fs.readFileSync(filename, 'utf-8')
    const parsed = vueParser(content, filename, false, '', false)
    return {
      mount ($el) {
        console.log(parsed)
        $el.innerHTML = content
      }
    }
  } else {
    return origLoad.call(this, request, parent, isMain)
  }
}

