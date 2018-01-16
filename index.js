require('babel-register')
require('./global')

if (typeof nw !== 'undefined' && !process.env.SERVICE) {
  require('./gui')
} else {
  switch (process.env.SERVICE) {
  case 'gen-ssl':
    require('./service/gen-ssl')
    break
  default:
    require('./service')
    break
  }
}

