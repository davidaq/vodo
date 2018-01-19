import deepmerge from 'deepmerge'

let initStoreData = JSON.parse(readAssets('app-data.json'))
try {
  initStoreData = deepmerge(
    initStoreData,
    JSON.parse(readUserData('app-data.json')),
    {
      arrayMerge: (a, b) => b
    }
  )
} catch (err) {
}
global.Store = createBoundObj(initStoreData || {})

let storeSyncTimeout
let storeSyncHash

IPC.on('store-sync', (hash, value) => {
  if (hash !== storeSyncHash) {
    global.Store = createBoundObj(JSON.parse(value))
  }
  if (IPC.isMain) {
    writeUserData('app-data.json', JSON.stringify(global.Store))
  }
})

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
      value = createBoundObj(value)
      target[key] = value
      if (!storeSyncTimeout) {
        storeSyncTimeout = setTimeout(() => {
          storeSyncTimeout = 0
          const value = JSON.stringify(global.Store)
          storeSyncHash = ID()
          IPC.emit('store-sync', storeSyncHash, value)
        }, 100)
      }
      return value
    }
  })
}
