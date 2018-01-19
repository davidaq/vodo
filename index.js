require('babel-register')
require('./globals')

global.React = require('react')
global.CSS = require('./gui/js-css').default
require('./gui/components/title-bar')

// if (typeof nw !== 'undefined' && !process.env.SERVICE && !process.env.HEADLESS) {
//   require('./gui')
// } else {
//   console.error('Start worker service:', process.env.SERVICE || 'index')
//   let modName = './service'
//   if (process.env.SERVICE) {
//     modName += '/' + process.env.SERVICE
//   }
//   require(modName).main()
// }
// 
