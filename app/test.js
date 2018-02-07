require('./globals/babel-helpers')
require('babel-register')
require('./globals')
//require('./gui')
const cert = require('./service/ssl-cert').generateCert('baidu.com')
console.log(cert.cert + cert.upperCert)

