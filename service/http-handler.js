import { createServer } from 'http'
import { connect as connectTCP } from 'net'
import { serve as serveApi } from './api'
import { certDomain } from './ssl-tunnel'
import { handleProxy } from './handle-proxy'

const sslOriginUrl = {}

const handleHTTP = (req, res) => {
  if (!/https?:\/\//i.test(req.url)) {
    if (req.socket.remoteAddress === '127.0.0.1') {
      setTimeout(() => {
        const originUrl = sslOriginUrl[req.socket.remotePort]
        if (originUrl) {
          req.url = `https://${originUrl}${req.url}`
          if (!req.socket.sslOriginHandled) {
            req.socket.sslOriginHandled = true
            req.socket.on('close', () => {
              delete sslOriginUrl[req.socket.remotePort]
            })
          }
          handleProxy(req, res)
        } else {
          serveApi(req, res)
        }
      }, 10)
    } else {
      serveApi(req, res)
    }
  } else {
    handleProxy(req, res)
  }
}

const connectSSLTunnel = (req, sock, head) => {
  // sock.once('data', chunk => {
  //   console.log(chunk.toString())
  // })
  let [domain, port = '443'] = req.url.split(':')
  sock.pause()
  const doTunnel = tunnel => {
    pipeOnConnect(sock, tunnel, () => {
      sock.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: zokor\r\n\r\n')
      tunnel.write(head)
    })
  }
  doTunnel(connectTCP(port, domain))
  return
  domain = certDomain(domain)
  IPC.request('get-ssl-tunnel-port', domain)
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
httpServer.on('upgrade', (req) => {
  console.log('upgrade', req.url)
})
httpServer.listen(0, '127.0.0.1', () => {
  const { port } = httpServer.address()
  IPC.request('register-http-worker', port)
  IPC.answer(`ssl-origin-url-t2:${port}`, ({ port, url }) => {
    sslOriginUrl[port] = url
  })
})


