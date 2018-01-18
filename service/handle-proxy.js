import { request as requestHTTP } from 'http'
import { request as requestHTTPS } from 'https'
import { createGzip, createGunzip, constants, Z_SYNC_FLUSH } from 'zlib'
import { PassThrough } from 'stream'
import { stat, createReadStream, createWriteStream } from 'fs'
import { parse } from 'url'

function restoreHeaders (headers, rawHeaders) {
  const outHeaders = {}
  rawHeaders.forEach((key, i) => {
    if (i % 2 === 0) {
      const lKey = key.toLowerCase()
      if (headers.hasOwnProperty(lKey)) {
        outHeaders[key] = headers[lKey]
      }
    }
  })
  return outHeaders
}

export const handleProxy = (req, res) => {
  const requestID = ID()
  const clientAllowGzip = /gzip/.test(req.headers['accept-encoding'] || '')
  req.headers['accept-encoding'] = 'gzip'
  const options = Object.assign({}, parse(req.url))
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
  options.port = `${options.port}`
  options.headers = restoreHeaders(req.headers, req.rawHeaders)
  options.method = req.method
  options.requestID = requestID
  if (options.protocol === 'file:') {
    serveStatic(options, req, res)
    return
  }
  const request = options.protocol === 'https:'
    ? requestHTTPS
    : requestHTTP
  const startTime = Date.now()
  options.startTime = startTime
  IPC.request('record-request', requestID, options)
  IPC.emit('caught-request-begin', {
    requestID,
    startTime,
    protocol: options.protocol,
    hostname: options.hostname,
    port: options.port,
    method: options.method,
    pathname: options.pathname
  })
  console.info(requestID, options.method, options.protocol, options.hostname, options.pathname.substr(0, 50))
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
    } else if (clientAllowGzip) {
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
        proxyRes.rawHeaders.push('Content-Encoding')
        proxyRes.rawHeaders.push('gzip')
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
    const responseHeaders = restoreHeaders(proxyRes.headers, proxyRes.rawHeaders)
    const responseTime = Date.now()
    IPC.request('record-request', requestID, {
      statusCode: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      responseHeaders,
      responseTime,
      responseElapse: responseTime - startTime
    })
    IPC.emit('caught-request-respond', requestID)
    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, responseHeaders)
    res.headWritten = true
    encodedRes.pipe(res)
    let size = 0
    const responseBuffer = []
    decodedRes.on('data', (chunk) => {
      size += chunk.length
      if (size < bodyLimit) {
        responseBuffer.push(chunk)
      }
    })
    decodedRes.on('end', () => {
      const finishTime = Date.now()
      const finishElapse = finishTime - startTime
      const responseBody = size < bodyLimit ? Buffer.concat(responseBuffer).toString('binary') : null
      IPC.request('record-request', requestID, {
        responseBodySize: size,
        responseBody,
        finishTime,
        finishElapse
      })
      IPC.emit('caught-request-finish', requestID, { size, finishElapse })
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
    const requestBody = requestBodySize < bodyLimit ? Buffer.concat(requestBuffer).toString('binary') : null
    IPC.request('record-request', requestID, {
      requestBodySize,
      requestBody
    })
  })
  req.on('error', err => {
    proxyReq.end()
    IPC.request('record-request', requestID, {
      error: err.message
    })
    IPC.emit('caught-request-error', requestID, err.message)
  })
  proxyReq.on('error', err => {
    IPC.request('record-request', requestID, {
      error: err.message
    })
    IPC.emit('caught-request-error', requestID, err.message)
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
  for (let i = 0; i < Store.replace.length; i++) {
    const rule = Store.replace[i]
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
        if (rule.to.path) {
          options.pathname = rule.to.path
          if (rule.from.path && rule.to.exact && !rule.from.exact) {
            options.pathname += options.pathname.substr(rule.from.path.length)
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
  const headers = {
    'Access-Control-Allow-Origin': req.headers['origin'] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': Store.config.corsHeaders || 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Encoding': clientAllowGzip ? 'gzip' : 'identity'
  }
  const { requestID } = options
  options.protocol = 'file:'
  options.hostname = '[local file]'
  options.host = '[local file]'
  options.port = '0'
  const startTime = Date.now()
  IPC.request('record-request', requestID, options)
  IPC.emit('caught-request-begin', {
    requestID,
    startTime,
    protocol: options.protocol,
    hostname: options.hostname,
    port: options.port,
    method: options.method,
    pathname: options.pathname
  })
  stat(options.pathname, (err, info) => {
    if (err || !info.isFile()) {
      res.writeHead(404, headers)
      res.end('File not found')
      IPC.request('record-request', requestID, {
        error: 'file not found'
      })
      IPC.emit('caught-request-error', requestID, 'file not found')
    } else {
      const responseTime = Date.now()
      IPC.request('record-request', requestID, Object.assign({
        statusCode: 200,
        statusMessage: 'OK',
        responseHeaders: headers,
        responseTime,
        responseElapse: responseTime - startTime,
        requestBodySize: 0,
      }, options))
      IPC.emit('caught-request-respond', requestID)
      res.writeHead(200, headers)
      const reader = createReadStream(options.path)
      let encodedRes = reader
      if (clientAllowGzip) {
        encodedRes = createGzip({ flush: Z_SYNC_FLUSH || constants.Z_SYNC_FLUSH })
        encodedRes.on('error', () => res.end())
        reader.pipe(encodedRes)
      }
      encodedRes.pipe(res)
      reader.on('end', () => {
        const finishTime = Date.now()
        const finishElapse = finishTime - startTime
        IPC.request('record-request', requestID, {
          responseBodySize: info.size,
          finishTime,
          finishElapse
        })
        IPC.emit('caught-request-finish', requestID, {
          size: info.size, finishElapse
        })
      })
      reader.on('error', () => res.end())
    }
  })
}

