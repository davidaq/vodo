import { writeFile, readFile, readdir, mkdir, rename, stat, unlink } from 'fs'
import { resolve, relative, join, dirname } from 'path'
import unzip from 'decompress-unzip'

const basedir = join(__dirname, '..')

Promise.all([
  new Promise(resolve => {
    readFile(join(basedir, 'package.json'), (err, content) => {
      const { version } = JSON.parse(content)
      resolve(version)
    })
  }),
  new Promise(resolve => {
    readFile(join(basedir, 'version.txt'), (err, content) => {
      if (err) {
        resolve(null)
      } else {
        resolve(content.toString().trim())
      }
    })
  }),
  fetch('https://api.github.com/repos/davidaq/vodo/releases')
  .then(r => r.json())
])
.then(([baseVersion, curVersion, versionList]) => {
  curVersion = curVersion || baseVersion
  for (const version of versionList) {
    if (!/^patch-/.test(version.name)) {
      continue
    }
    if (version.body.indexOf(`- ${curVersion}`) < 0) {
      continue
    }
    const match = version.body.match(/\[patch bundle\]\((.*?)\)/)
    if (!match) {
      continue
    }
    const bundleUrl = match[1]
    Promise.all([
      fetch(bundleUrl)
        .then(r => r.arrayBuffer())
        .then(r => unzip()(new Buffer(new Uint8Array(r)))),
      remove(join(basedir, 'next'))
      .then(() => copy(join(basedir, 'app'), join(basedir, 'next', 'app')))
      .then(() => copy(join(basedir, 'node_modules'), join(basedir, 'next', 'node_modules')))
      .then(() => copy(join(basedir, 'package.json'), join(basedir, 'next', 'package.json')))
    ])
    .then(([files]) => {
      return Promise.all(files.map(file => {
        if (file.type === 'file') {
          const fpath = resolve(basedir, 'next', file.path
          return ensureDir(dirname(fpath))
          .then(() => writeFile(fpath, new Buffer(file.data)))
        } else {
          return Promise.resolve()
        }
      }))
    })
    .then(() => {
      const ver = version.name.replace(/^patch-/, '')
      return new Promise(accept => {
        writeFile(join(basedir, 'next', 'version.txt'), ver, () => accept())
      })
    })
    .then(() => {
      console.log('ready')
    })
    break
  }
})
.catch(err => console.error(err))

const ensured = {}
function ensureDir (dir) {
  if (!ensured[dir]) {
    ensured[dir] = ensureDir(dirname(dir))
    .then(new Promise(accept => {
      mkdir(dir, () => accept())
    }))
  }
  return ensured[dir]
}

function walk (entry, opt) {
  return new Promise(accept => {
    stat(entry, (err, info) => {
      if (err) {
        accept()
      } else if (info.isDirectory()) {
        Promise.resolve(opt.onDir && opt.onDir(entry))
        .then(() => {
          readdir(entry, (list) => {
            accept(Promise.all(list.map(item => {
              return walk(join(entry, item), opt)
            })))
          })
        })
        .then(() => opt.afterDir && opt.afterDir(entry))
      } else {
        accept(opt.onFile && opt.onFile(entry))
      }
    })
  })
}

function copy (from, to) {
  return walk(resolve(from), {
    onFile (fromPath) {
      const toPath = resolve(to, relative(from, fromPath))
      return ensureDir(dirname(toPath))
      .then(() => new Promise(accept => {
        readFile(fromPath, (err, content) => {
          if (err) {
            accept()
          } else {
            writeFile(toPath, content, () => accept())
          }
        })
      }))
    }
  })
}

function remove (fpath) {
  return walk(resolve(fpath), {
    onFile (entry) {
      return new Promise(accept => {
        unlink(fpath, () => accept())
      })
    },
    afterDir (entry) {
      return new Promise(accept => {
        unlink(fpath, () => accept())
      })
    }
  })
}

