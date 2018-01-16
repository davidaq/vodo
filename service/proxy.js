import { request as requestHTTP, createServer } from 'http'
import { request as requestHTTPS } from 'https'
import { connect as connectTCP } from 'net'

export const serve = (req, res) => {
  if (true||process.env.SERVICE === 'proxy') {
    const options = Object.assign({}, req.parsedUrl)
    options.headers = req.headers
    options.method = req.method
    const request = options.protocol === 'https:'
      ? requestHTTPS
      : requestHTTP
    const proxyReq = request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      res.headWritten = true
      proxyRes.pipe(res)
    })
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
  } else {
    IPC.request('proxy-worker')
    .then(port => {
      serve(req, res)
    })
  }
}

if (process.env.SERVICE === 'proxy') {
  const server = createServer(serve)
  server.listen(0, '127.0.0.1', () => {
    IPC.answer('proxy-worker', () => server.address().port)
  })
}

