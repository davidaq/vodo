import { request as requestHTTP, createServer } from 'http'
import { request as requestHTTPS } from 'https'
import { connect as connectTCP } from 'net'
import { parse } from 'url'
import { serve as serveApi } from './api'
import { certDomain } from './ssl-tunnel'

const sslOriginUrl = {}

const handleHTTP = (req, res) => {
  const handle = () => {
    let { url } = req
    if (!/https?:\/\//i.test(url)) {
      url = `http://api${url}`
    }
    console.log(url)
    req.parsedUrl = parse(url)
    if (req.parsedUrl.hostname === 'api') {
      serveApi(req, res)
    } else {
      handleProxy(req, res)
    }
  }
  if (req.socket.remoteAddress === '127.0.0.1') {
    const originUrl = sslOriginUrl[req.socket.remotePort]
    if (originUrl) {
      delete sslOriginUrl[req.socket.remotePort]
      req.url = `https://${originUrl}${req.url}`
    }
  }
  handle()
}

const handleProxy = (req, res) => {
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
}

const connectSSLTunnel = (req, sock, head) => {
  let [domain, port = '443'] = req.url.split(':')
  domain = certDomain(domain)
  const doTunnel = tunnel => {
    tunnel.on('connect', () => {
      sock.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: zokor\r\n\r\n')
      tunnel.write(head)
      sock.pipe(tunnel)
      tunnel.pipe(sock)
    })
    sock.on('error', () => tunnel.end())
    tunnel.on('error', () => sock.end())
  }
  IPC.request('ssl-tunnel-port', domain)
  .then(port => {
    const sock = connectTCP(port, '127.0.0.1')
    sock.on('connect', () => {
      IPC.request(`ssl-origin-url-t1:${port}`, {
        port: sock.localPort,
        url: req.url
      })
    })
    doTunnel(sock)
  }, error => console.error(error.stack))
}

const httpServer = createServer(handleHTTP)
httpServer.on('connect', connectSSLTunnel)
httpServer.listen(0, '127.0.0.1', () => {
  const { port } = httpServer.address()
  IPC.request('register-http-worker', port)
  IPC.answer(`ssl-origin-url-t2:${port}`, ({ port, url }) => {
    sslOriginUrl[port] = url
  })
})

