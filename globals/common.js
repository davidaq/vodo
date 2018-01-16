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

global.userDir = join(homedir(), '.zokor')

global.ID = shortid.generate.bind(shortid)

if (!process.FORKED) {
  try {
    mkdirSync(userDir)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

global.readUserData = name => {
  try {
    return readFileSync(join(userDir, name))
  } catch (err) {
    return null
  }
}

global.writeUserData = (name, content) => {
  writeFile(join(userDir, name), content, err => null)
}

