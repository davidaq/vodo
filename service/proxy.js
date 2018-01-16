import { request as requestHTTP } from 'http'
import { request as requestHTTPS } from 'https'
import { connect as connectTCP } from 'net'
import { parse } from 'url'
import { getTunnelFor } from './ssl-tunnel'

export const serve = (req, res) => {
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

export const connect = (req, sock, head) => {
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
  getTunnelFor(req.url, serve, doTunnel)
}

