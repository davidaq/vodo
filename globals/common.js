import { readFileSync, writeFile, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import React from 'react'
import shortid from 'shortid'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

global.React = React

global.readAssets = name => {
  return readFileSync(join(__dirname, '..', 'assets', name))
}

global.userDir = (...args) => join(homedir(), '.zokor', ...args)

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

