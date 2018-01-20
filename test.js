const { pki, md } = require('node-forge')
const { readFileSync } = require('fs')

const rootCA = pki.certificateFromPem(readFileSync('./assets/rootCA.crt'))
console.log(new Buffer(rootCA.extensions[2].value, 'binary'))

const { cer } = JSON.parse(readFileSync('c:/Users/Administrator/.vodo/ca.json').toString())
const currCA = pki.certificateFromPem(cer)
console.log(currCA.extensions)
