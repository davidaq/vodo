import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
if (process.send) {
  setTimeout(() => {
    process.send({ type: 'PROCESS_STARTED' })
  }, 50)
}

global.React = React

global.readAssets = name => readFileSync(join(__dirname, 'assets', name))

global.Store = createBoundObj({})

function createBoundObj (value, noCopy = false) {
  if (!noCopy && value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value = value.map(item => createBoundObj(item))
    } else {
      const clone = createBoundObj({}, true)
      Object.keys(value).forEach(key => {
        clone[key] = createBoundObj(value[key])
      })
      value = clone
    }
  } else {
    return value
  }
  return new Proxy(value, {
    set (target, key, value) {
      target[key] = createBoundObj(value)
      console.log('changed')
    }
  })
}

