require('babel-register')
require('./globals')
const { fork } = require('child_process')

const { UPDATER, SERVICE, HEADLESS } = process.env

if (UPDATER) {
  require('./update')
} else if (typeof nw !== 'undefined' && !SERVICE && !HEADLESS) {
  //fork('./update', { env: { UPDATER: 1 } })
  require('./update')
  require('./gui')
} else {
  console.error('Start worker service:', SERVICE || 'index')
  let modName = './service'
  if (SERVICE) {
    modName += '/' + SERVICE
  }
  require(modName).main()
}

