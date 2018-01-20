import { readFileSync, writeFile, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import shortid from 'shortid'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

global.readAssets = name => {
  return readFileSync(join(__dirname, '..', 'assets', name))
}

global.userDir = (...args) => join(homedir(), '.vodo', ...args)

global.ID = shortid.generate.bind(shortid)

if (!process.FORKED) {
  try {
    mkdirSync(userDir())
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

global.readUserData = name => {
  try {
    return readFileSync(userDir(name))
  } catch (err) {
    return null
  }
}

global.writeUserData = (name, content, cb) => {
  writeFile(userDir(name), content, err => cb && cb(err))
}

global.pipeOnConnect = (from, to, cb) => {
  const stack = new Error().stack
  from.pause()
  to.on('connect', () => {
    cb && cb()
    from.pipe(to)
    to.pipe(from)
    from.resume()
  })
  from.on('error', (err) => {
    console.error(err.message, stack)
    to.end()
  })
  to.on('error', (err) => {
    console.error(err.message, stack)
    from.end()
  })
}

