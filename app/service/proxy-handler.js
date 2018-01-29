import { request as requestHTTP } from 'http'
import { request as requestHTTPS } from 'https'
import { createGzip, createGunzip, constants, Z_SYNC_FLUSH } from 'zlib'
import { PassThrough } from 'stream'
import { stat, createReadStream, createWriteStream } from 'fs'
import { parse } from 'url'
import isUtf8 from 'isutf8'

const forbidenInjectHeaderkeys = {
  'accept': true,
  'accept-encoding': true,
  'content-encoding': true,
  'transfer-encoding': true,
  'content-length': true
}

function resolveHeaders (headers, rawHeaders, injectHeaders) {
  const outHeaders = {}
  const renameHeaders = {}
  Object.keys(headers).forEach(key => {
    const loKey = key.toLowerCase()
    if (loKey !== key) {
      renameHeaders[loKey] = key
    }
  })
  if (rawHeaders) {
    rawHeaders.forEach((key, i) => {
      if (i % 2 === 0) {
        const loKey = key.toLowerCase()
        if (loKey !== key) {
          renameHeaders[loKey] = key
        }
      }
    })
  }
  rawHeaders
    ? rawHeaders.filter((v, i) => i % 2 === 0).map(v => [v.toLowerCase(), v])
    : []
  Object.keys(headers).forEach(key => {
    outHeaders[key.toLowerCase()] = headers[key]
  })
  if (injectHeaders) {
    Object.keys(injectHeaders).forEach(key => {
      const loKey = key.toLowerCase()
      if (loKey !== key) {
        renameHeaders[loKey] = key
      }
      if (!forbidenInjectHeaderkeys[loKey]) {
        outHeaders[loKey] = injectHeaders[key]
      }
    })
  }
  Object.keys(renameHeaders).forEach((loKey) => {
    const key = renameHeaders[loKey]
    if (outHeaders.hasOwnProperty(loKey)) {
      outHeaders[key] = outHeaders[loKey]
      delete outHeaders[loKey]
    }
  })
  return outHeaders
}

export const handleProxy = (req, res) => {
  const clientAllowGzip = /gzip/.test(req.headers['accept-encoding'] || '')
  req.headers['accept-encoding'] = 'gzip'
  const options = parse(req.url)
  if (options.protocol === 'https:' && !options.port) {
    options.port = '443'
  }
  if (options.protocol === 'http:' && !options.port) {
    options.port = '80'
  }
  try {
    handleReplace(options)
  } catch (err) {
    console.error(err.stack)
  }
  let maybeHTML = !!/^text\/html/.test(req.headers['accept'])
  if (maybeHTML) {
    req.headers['cache-control'] = 'no-cache'
    req.headers['pragma'] = 'no-cache'
    Object.keys(req.headers).forEach((key) => {
      if (key.substr(0, 3) === 'if-') {
        delete req.headers[key]
      }
    })
  }
  if (!Store.config.useHtmlInjectScript) {
    maybeHTML = false
  }
  if (Store.config.recordRequest && !req.headers['x-vodo-no-record']) {
    options.requestID = ID()
  }
  delete req.headers['x-vodo-no-record']
  options.port = `${options.port}`
  options.headers = resolveHeaders(req.headers, req.rawHeaders, options.injectRequestHeaders)
  options.method = req.method
  if (options.protocol === 'file:') {
    serveStatic(options, req, res)
    return
  }
  const request = options.protocol === 'https:'
    ? requestHTTPS
    : requestHTTP
  const startTime = Date.now()
  options.startTime = startTime
  if (options.requestID) {
    IPC.request('record-request', options.requestID, options)
    IPC.emit('caught-request-begin', {
      requestID: options.requestID,
      startTime,
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port,
      method: options.method,
      pathname: options.pathname
    })
  }
  if (options.requestID) {
    console.info(options.requestID, options.method, options.protocol, options.hostname, options.pathname.substr(0, 50))
  }
  options.timeout = 5000
  const bodyLimit = Store.config.singleRequestLimit * 1024 * 1024
  const proxyReq = request(options, proxyRes => {
    let decodedRes = proxyRes
    let encodedRes = proxyRes
    if (proxyRes.headers['content-encoding'] === 'gzip') {
      decodedRes = createGunzip()
      decodedRes.on('error', err => console.error(err.stack) || decodedRes.end())
      proxyRes.pipe(decodedRes)
      if (!clientAllowGzip) {
        encodedRes = decodedRes
        proxyRes.headers['content-encoding'] = 'identity'
      }
    } else if (!maybeHTML && clientAllowGzip) {
      const contentType = proxyRes.headers['content-type']
      let wrapGzip = true
      if (contentType) {
        if (/image|audio|video/.test(contentType)) {
          wrapGzip = false
        } else if (contentType !== 'application/json' && /application/.test(contentType)) {
          wrapGzip = false
        }
      }
      if (wrapGzip) {
        proxyRes.headers['content-encoding'] = 'gzip'
        if (proxyRes.headers['content-length']) {
          delete proxyRes.headers['content-length']
          encodedRes = createGzip()
        } else {
          encodedRes = createGzip({ flush: Z_SYNC_FLUSH || constants.Z_SYNC_FLUSH })
        }
        encodedRes.on('error', err => console.error(err.stack) || encodedRes.end())
        proxyRes.pipe(encodedRes)
      }
    }
    if (maybeHTML) {
      proxyRes.headers['content-encoding'] = 'identity'
      proxyRes.headers['cache-control'] = 'no-cache'
      delete proxyRes.headers['expires']
      delete proxyRes.headers['content-length']
      delete proxyRes.headers['content-security-policy']
    }
    const responseHeaders = resolveHeaders(proxyRes.headers, proxyRes.rawHeaders, options.injectResponseHeaders)
    const responseTime = Date.now()
    if (options.requestID) {
      IPC.request('record-request', options.requestID, {
        statusCode: proxyRes.statusCode,
        statusMessage: proxyRes.statusMessage,
        responseHeaders,
        responseTime,
        responseElapse: responseTime - startTime
      })
      IPC.emit('caught-request-respond', options.requestID)
    }
    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, responseHeaders)
    res.headWritten = true
    if (!maybeHTML) {
      encodedRes.pipe(res)
    }
    let size = 0
    const responseBuffer = []
    decodedRes.on('data', (chunk) => {
      if (maybeHTML) {
        if (size === 0 && isUtf8(chunk)) {
          let headContent = chunk.toString()
          if (/\<html.*?\>/i.test(headContent)) {
            if (/\<head.*?\>/i.test(headContent)) {
              headContent = headContent.replace(
                /(\<head.*?\>)/i,
                `$1<script src="/---vodo---/inject.js?${Date.now()}"></script>`
              )
            } else {
              headContent = headContent.replace(
                /(\<html.*?\>)/i,
                `$1<script src="/---vodo---/inject.js?${Date.now()}"></script>`
              )
            }
            chunk = new Buffer(headContent)
          }
        }
        res.write(chunk)
      }
      size += chunk.length
      if (size < bodyLimit) {
        responseBuffer.push(chunk)
      }
    })
    decodedRes.on('end', () => {
      if (maybeHTML) {
        res.end()
      }
      const finishTime = Date.now()
      const finishElapse = finishTime - startTime
      const responseBodyIsTooLarge = size > bodyLimit
      const responseBody = !responseBodyIsTooLarge
        ? Buffer.concat(responseBuffer).toString('binary')
        : null
      if (options.requestID) {
        IPC.request('record-request', options.requestID, {
          responseBodySize: size,
          responseBody,
          responseBodyIsTooLarge,
          finishTime,
          finishElapse
        })
        IPC.emit('caught-request-finish', options.requestID, { size, finishElapse })
      }
    })
  })
  let requestBodySize = 0
  const requestBuffer = []
  req.pipe(proxyReq)
  req.on('data', (chunk) => {
    requestBodySize += chunk.length
    if (requestBodySize < bodyLimit) {
      requestBuffer.push(chunk)
    }
  })
  req.on('end', () => {
    if (options.requestID) {
      const requestBodyIsTooLarge = requestBodySize > bodyLimit
      const requestBody = !requestBodyIsTooLarge
        ? Buffer.concat(requestBuffer).toString('binary')
        : null
      IPC.request('record-request', options.requestID, {
        requestBodySize,
        requestBodyIsTooLarge,
        requestBody
      })
    }
  })
  req.on('error', err => {
    proxyReq.end()
    if (options.requestID) {
      IPC.request('record-request', options.requestID, {
        error: err.message
      })
      IPC.emit('caught-request-error', options.requestID, err.message)
    }
  })
  req.on('aborted', () => {
    proxyReq.abort()
    if (options.requestID) {
      IPC.request('record-request', options.requestID, {
        error: 'aborted'
      })
      IPC.emit('caught-request-error', options.requestID, 'aborted')
    }
  })
  proxyReq.on('error', err => {
    if (options.requestID) {
      IPC.request('record-request', options.requestID, {
        error: err.message
      })
      IPC.emit('caught-request-error', options.requestID, err.message)
    }
    if (!res.headWritten) {
      res.writeHead(502)
      res.end(JSON.stringify({
        error: 'target server failed',
        code: 502,
        message: err.message
      }, false, '  '))
    } else {
      res.end('')
    }
  })
}

const handleReplace = (options) => {
  if (!Store.config.useReplaceRules) {
    return
  }
  for (let i = 0; i < Store.replaceRules.length; i++) {
    const rule = Store.replaceRules[i]
    if (!rule.enabled) {
      continue
    }
    if (!rule.from.protocol || !rule.from.domain || !rule.from.port) {
      continue
    }
    if (rule.to.protocol === 'file:') {
      if (!rule.to.path) {
        continue
      }
    } else if (!rule.to.protocol || !rule.to.domain || !rule.to.port) {
      continue
    }
    if (
      rule.from.protocol === options.protocol &&
      rule.from.domain === options.hostname &&
      +rule.from.port === +options.port
     ) {
      let match = true
      if (rule.from.path) {
        if (rule.from.exact) {
          match = rule.from.path === options.pathname
        } else {
          match = options.pathname.substr(0, rule.from.path.length) === rule.from.path
        }
      }
      if (match) {
        options.protocol = rule.to.protocol
        options.hostname = rule.to.domain
        options.host = rule.to.domain
        options.port = rule.to.port
        options.injectRequestHeaders = rule.requestHeaders
        options.injectResponseHeaders = rule.responseHeaders
        if (rule.to.path) {
          const oPath = options.pathname
          options.pathname = rule.to.path
          if (rule.from.path && !rule.to.exact && !rule.from.exact) {
            options.pathname += oPath.substr(rule.from.path.length)
          }
          options.path = options.pathname
          if (options.search) {
            options.path += options.search
          }
        }
        options.href = options.protocol + '//' + options.hostname +
          ':' + options.port + options.path
        if (options.hash) {
          options.href += options.hash
        }
        break
      }
    }
  }
}

const serveStatic = (options, req, res) => {
  const clientAllowGzip = /gzip/.test(req.headers['accept-encoding'] || '')
  const headers = resolveHeaders({
    'Access-Control-Allow-Origin': req.headers['origin'] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Encoding': clientAllowGzip ? 'gzip' : 'identity'
  }, null, options.injectResponseHeaders)
  if (req.method.toLowerCase() === 'options') {
    res.writeHead(200, headers)
    res.end()
    return
  }
  options.protocol = 'file:'
  options.hostname = '[local file]'
  options.host = '[local file]'
  options.port = '0'
  const startTime = Date.now()
  if (options.requestID) {
    IPC.request('record-request', options.requestID, options)
    IPC.emit('caught-request-begin', {
      requestID: options.requestID,
      startTime,
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port,
      method: options.method,
      pathname: options.pathname
    })
  }
  stat(options.pathname, (err, info) => {
    if (err || !info.isFile()) {
      delete headers['Content-Encoding']
      res.writeHead(404, headers)
      res.end('File not found')
      if (options.requestID) {
        IPC.request('record-request', options.requestID, {
          error: 'file not found'
        })
        IPC.emit('caught-request-error', options.requestID, 'file not found')
      }
    } else {
      const responseTime = Date.now()
      if (options.requestID) {
        IPC.request('record-request', options.requestID, {
          statusCode: 200,
          statusMessage: 'OK',
          responseHeaders: headers,
          responseTime,
          responseElapse: responseTime - startTime,
          requestBodySize: 0,
          requestBody: '',
          ...options
        })
        IPC.emit('caught-request-respond', options.requestID)
      }
      res.writeHead(200, headers)
      const reader = createReadStream(options.pathname)
      let encodedRes = reader
      if (clientAllowGzip) {
        encodedRes = createGzip({ flush: Z_SYNC_FLUSH || constants.Z_SYNC_FLUSH })
        encodedRes.on('error', () => res.end())
        reader.pipe(encodedRes)
      }
      const responseBody = []
      const bodyLimit = Store.config.singleRequestLimit * 1024 * 1024
      if (info.size < bodyLimit) {
        reader.on('data', chunk => {
          responseBody.push(chunk)
        })
      }
      encodedRes.pipe(res)
      reader.on('end', () => {
        const finishTime = Date.now()
        const finishElapse = finishTime - startTime
        if (options.requestID) {
          IPC.request('record-request', options.requestID, {
            responseBodySize: info.size,
            responseBody: (responseBody.length > 0
              ? Buffer.concat(responseBody)
              : new Buffer(`<本地文件: ${options.pathname}>`)
            ).toString('binary'),
            finishTime,
            finishElapse
          })
          IPC.emit('caught-request-finish', options.requestID, {
            size: info.size, finishElapse
          })
        }
      })
      reader.on('error', () => res.end())
    }
  })
}

