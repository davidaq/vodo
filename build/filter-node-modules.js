const path = require('path')

const nodeModulesDir = path.join(path.resolve(__dirname, '..', 'node_modules'), ' ').trim()

const buffer = []
process.stdin.on('data', (chunk) => {
  buffer.push(chunk)
})
process.stdin.on('end', () => {
  const list = Buffer.concat(buffer).toString().split('\n').map(v => v.trim()).filter(v => !!v)
  list.forEach(v => {
    v = v.replace(nodeModulesDir, '')
    if (!/[\/\\]/.test(v)) {
      console.log(v)
    }
  })
})
