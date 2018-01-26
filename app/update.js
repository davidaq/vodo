import { writeFile, readFile, readdir, mkdir, rename, stat, unlink } from 'fs'
import { resolve, relative, join, dirname } from 'path'
import unzip from 'decompress-unzip'
import { fork } from 'child_process'
import { ncp } from 'ncp'
import rimraf from 'rimraf'

const basedir = join(__dirname, '..')

if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch')
}

export const prepare = () => {
  if (process.env.DEV) {
    return
  }
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
      return Promise.all([
        fetch(bundleUrl)
          .then(r => r.buffer ? r.buffer() : r.arrayBuffer().then(r => new Buffer(new Uint8Array(r))))
          .then(r => unzip()(r)),
         remove(join(basedir, 'next')).catch(err => null)
      ])
      .then(([files]) => {
        let ret = Promise.resolve()
        files.forEach(file => {
          ret = ret.then(() => {
            if (file.type === 'file') {
              const fpath = resolve(basedir, 'next', file.path)
              return ensureDir(dirname(fpath))
              .then(() => new Promise((accept, reject) => {
                writeFile(fpath, file.data, err => err ? reject(err) : accept())
              }))
            }
          })
        })
        return ret
      })
      .then(() => {
        const copyIfNotExist = (item) => {
          return exists(join(basedir, 'next', item))
          .then((ok) => {
            if (!ok) {
              return copy(join(basedir, item), join(basedir, 'next', item))
            }
          })
        }
        return Promise.all([
          'app',
          'node_modules',
          'package.json'
        ].map(copyIfNotExist))
      })
      .then(() => {
        const ver = version.name.replace(/^patch-/, '')
        return new Promise(accept => {
          writeFile(join(basedir, 'next', 'version.txt'), ver, () => accept())
        })
      })
    }
    setTimeout(prepare, 300000)
  })
  .catch(err => console.error(err.stack))
}

export const startup = () => {
  return new Promise(accept => {
    stat(join(basedir, 'next', 'version.txt'), (err, info) => {
      accept(!err && info.isFile() && info.size > 0)
    })
  })
  .then((ready) => {
    if (ready) {
      return remove(join(basedir, 'old'))
      .catch(err => null)
      .then(() => ensureDir(resolve(basedir, 'old')))
      .then(() => move(join(basedir, 'app'), join(basedir, 'old', 'app')))
      .then(() => move(join(basedir, 'node_modules'), join(basedir, 'old', 'node_modules')))
      .then(() => move(join(basedir, 'package.json'), join(basedir, 'old', 'package.json')))
      .then(() => move(join(basedir, 'version.txt'), join(basedir, 'old', 'version.txt')))
      .catch(err => null)
      .then(() => move(join(basedir, 'next', 'app'), join(basedir, 'app')))
      .then(() => move(join(basedir, 'next', 'node_modules'), join(basedir, 'node_modules')))
      .then(() => move(join(basedir, 'next', 'package.json'), join(basedir, 'package.json')))
      .then(() => move(join(basedir, 'next', 'version.txt'), join(basedir, 'version.txt')))
    }
  })
  .then(() => {
    fork(require.resolve('./index'), { env: { UPDATER: 1 } })
  })
}


let ensured = {}
function ensureDir (dir, resolved) {
  if (!resolved) {
    dir = resolve(dir)
  }
  if (!dir || dir.split(/[\/\\]+/).length < 3) {
    return Promise.resolve()
  }
  if (!ensured[dir]) {
    ensured[dir] = ensureDir(dirname(dir), true)
    .then(() => new Promise((accept, reject) => {
      mkdir(dir, (err) => {
        if (err && err.code !== 'EEXIST') {
          reject(err)
        } else {
          accept()
        }
      })
    }))
  }
  return ensured[dir]
}

ncp.limit = 16
const copyOptions = {
  stopOnErr: true
}
function copy (from, to) {
  from = resolve(from)
  to = resolve(to)
  return new Promise((accept, reject) => {
    ncp(from, to, copyOptions, err => err ? reject(err) : accept())
  })
}

let rmCounter = 0
function remove (fpath) {
  ensured = {}
  const tmp = `${fpath}.remove.${Date.now()}.${rmCounter++}`
  return move(fpath, tmp)
  .then(() => {
    ensured = {}
    rimraf(tmp, () => null)
  })
}

function move (from, to) {
  return new Promise((accept, reject) => {
    rename(from, to, (err) => err ? reject(err) : accept(err))
  })
}

function exists (fpath) {
  return new Promise((accept) => {
    stat(fpath, (err, info) => {
      accept(!err && info)
    })
  })
}

