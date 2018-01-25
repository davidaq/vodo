require('babel-register')
require('./globals')

if (typeof nw !== 'undefined' && !process.env.SERVICE && !process.env.HEADLESS) {
  require('./update')
  require('./gui')
} else {
  console.error('Start worker service:', process.env.SERVICE || 'index')
  let modName = './service'
  if (process.env.SERVICE) {
    modName += '/' + process.env.SERVICE
  }
  require(modName).main()
}

