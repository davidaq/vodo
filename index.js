require('babel-register')
require('./globals')

if (typeof nw !== 'undefined' && !process.env.SERVICE) {
  require('./gui')
} else {
  let modName = './service'
  if (process.env.SERVICE) {
    modName += '/' + process.env.SERVICE
  }
  require(modName)
}

