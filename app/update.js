import { writeFile, readFile, readdir, mkdir, rename, stat, unlink } from 'fs'
import { resolve, relative, join, dirname } from 'path'
import unzip from 'decompress-unzip'
import { fork } from 'child_process'

const basedir = join(__dirname, '..')

export const prepare = () => {
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
         remove(join(basedir, 'next')).catch(err => null)
         .then(() => copy(join(basedir, 'app'), join(basedir, 'next', 'app')))
         .then(() => copy(join(basedir, 'node_modules'), join(basedir, 'next', 'node_modules')))
         .then(() => copy(join(basedir, 'package.json'), join(basedir, 'next', 'package.json')))
      ])
      .then(([files]) => {
        return Promise.all(files.map(file => {
          if (file.type === 'file') {
            const fpath = resolve(basedir, 'next', file.path)
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
      break
    }
  })
  .catch(err => console.error(err))
}

export const startup = () => {
  return new Promise(accept => {
    stat(join(basedir, 'next', 'version.txt'), (err, info) => {
      accept(!err && info.isFile() && info.size > 0)
    })
  })
  .then((ready) => {
    if (ready) {
      return remove(join(basedir, 'legend'))
      .catch(err => null)
      .then(() => move(join(basedir, 'old'), join(basedir, 'legend')))
      .catch(err => null)
      .then(() => ensureDir('old'))
      .then(() => move(join(basedir, 'app'), join(basedir, 'old', 'app')))
      .then(() => move(join(basedir, 'node_modules'), join(basedir, 'old', 'node_modules')))
      .then(() => move(join(basedir, 'package.json'), join(basedir, 'old', 'package.json')))
      .then(() => move(join(basedir, 'version.txt'), join(basedir, 'old', 'version.txt')))
      .catch(err => null)
      .then(() => move(join(basedir, 'next', 'app'), join(basedir, 'app')))
      .then(() => move(join(basedir, 'next', 'node_modules'), join(basedir, 'node_modules')))
      .then(() => move(join(basedir, 'next', 'package.json'), join(basedir, 'package.json')))
      .then(() => move(join(basedir, 'next', 'package.json'), join(basedir, 'package.json')))
      .then(() => move(join(basedir, 'next', 'version.txt'), join(basedir, 'version.txt')))
    }
  })
  .then(() => {
    fork(require.resolve('./index'), { env: { UPDATER: 1 } })
  })
}


const ensured = {}
function ensureDir (dir) {
  if (!ensured[dir]) {
    const parent = dirname(dir)
    const ensureParent = dir === parent
      ? Promise.resolve()
      : ensureDir(dirname(dir))
    ensured[dir] = ensureParent
    .then(new Promise(accept => {
      mkdir(dir, () => accept())
    }))
  }
  return ensured[dir]
}

function walk (entry, opt) {
  return new Promise((accept, reject) => {
    stat(entry, (err, info) => {
      if (err) {
        reject(err)
      } else if (info.isDirectory()) {
        Promise.resolve(opt.onDir && opt.onDir(entry))
        .then(() => {
          readdir(entry, (err, list) => {
            if (!err) {
              let ret = Promise.resolve()
              list.map(item => {
                ret = ret.then(() => walk(join(entry, item), opt))
              })
              accept(ret)
            } else {
              reject(err)
            }
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
  if (/nwjs-builder-phoenix/.test(from)) {
    return Promise.resolve()
  }
  return walk(resolve(from), {
    onFile (fromPath) {
      const toPath = resolve(to, relative(from, fromPath))
      return ensureDir(dirname(toPath))
      .then(() => new Promise(accept => {
        readFile(fromPath, (err, content) => {
          if (!err) {
            writeFile(toPath, content, () => accept())
          } else {
            reject(err)
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

function move (from, to) {
  return new Promise((accept, reject) => {
    rename(from, to, (err) => err ? reject(err) : accept(err))
  })
}

