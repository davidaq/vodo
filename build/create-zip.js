const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')

function addFile (fullName, zip) {
  return new Promise(resolve => {
    fs.readFile('build/dist/' + fullName, (err, content) => {
      zip.file(path.basename(fullName), content)
      console.log('PACK', fullName)
      resolve()
    })
  })
}
function walk (p, zip) {
  return new Promise(resolve => {
    fs.readdir('build/dist/' + p, (err, list) => {
      if (err) {
        throw err
      }
      Promise.all(
        list.map(item => new Promise(resolve => {
          const fullName = p + '/' + item
          fs.stat('build/dist/' + fullName, (err, stat) => {
            if (stat.isDirectory()) {
              resolve(walk(fullName, zip.folder(item)))
            } else {
              resolve(addFile(fullName, zip))
            }
          })
        }))
      ).then(resolve)
    })
  })
}

const zipFile = new JSZip()

Promise.all([
  addFile('package.json', zipFile),
  walk('app', zipFile.folder('app')),
  walk('node_modules', zipFile.folder('node_modules'))
])
.then(() => {
  console.log('WRITE')
  zipFile
  .generateNodeStream({
    type: 'nodebuffer',
    streamFiles: true,
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  })
  .pipe(fs.createWriteStream('build/dist/patch.zip'))
  .on('finish', () => {
    console.log('Generated bundle at build/dist/patch.zip')
  })
})
