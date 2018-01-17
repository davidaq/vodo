import { request as requestHTTP } from 'http'
import { request as requestHTTPS } from 'https'
import { createGzip, createGunzip, constants } from 'zlib'
import { createWriteStream } from 'fs'

export const handleProxy = (req, res) => {
  IPC.request('counter')
  .then(counter => {
    const requestID = counter
    const cycleId = requestID % Store.config.basic.saveRequestLimit
    const clientAllowGzip = /gzip/.test(req.headers['accept-encoding'])
    req.headers['accept-encoding'] = 'gzip'
    const options = Object.assign({}, req.parsedUrl)
    options.headers = req.headers
    options.method = req.method
    const request = options.protocol === 'https:'
      ? requestHTTPS
      : requestHTTP
    options.requestID = requestID
    writeUserData(`req-${cycleId}.json`, JSON.stringify(options))
    IPC.emit('caught-request-begin', {
      requestID,
      cycleId,
      hostname: options.hostname,
      method: options.method,
      pathname: options.pathname
    })
    const proxyReq = request(options, proxyRes => {
      proxyRes.pause()
      let decodedRes = proxyRes
      let encodedRes = proxyRes
      if (proxyRes.headers['content-encoding'] === 'gzip') {
        decodedRes = createGunzip()
        proxyRes.pipe(decodedRes)
        if (!clientAllowGzip) {
          encodedRes = decodedRes
          proxyRes.headers['content-encoding'] = 'identity'
        }
      } else if (clientAllowGzip) {
        proxyRes.headers['content-encoding'] = 'gzip'
        delete proxyRes.headers['content-length']
        encodedRes = createGzip({ flush: constants.Z_SYNC_FLUSH })
        proxyRes.pipe(encodedRes)
      }
      writeUserData(`res-${cycleId}.json`, JSON.stringify({
        requestID,
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers
      }), () => {
        IPC.emit('caught-request-respond', requestID)
      })
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      res.headWritten = true
      const resultBodyStream = createWriteStream(userDir(`res-${cycleId}.dat`))
      proxyReq.on('error', () => resultBodyStream.end())
      resultBodyStream.on('error', () => null)
      resultBodyStream.on('finish', () => {
        IPC.emit('caught-request-finish', requestID)
      })
      encodedRes.pipe(res)
      decodedRes.pipe(resultBodyStream)
      proxyRes.resume()
    })
    req.pipe(createWriteStream(userDir(`req-${cycleId}.dat`)))
    req.pipe(proxyReq)
    req.on('error', () => proxyReq.end())
    proxyReq.on('error', err => {
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
  })
}

