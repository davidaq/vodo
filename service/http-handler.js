import { createServer } from 'http'
import { connect as connectTCP } from 'net'
import { serve as serveApi } from './api'
import { certDomain } from './ssl-tunnel'
import { handleProxy } from './handle-proxy'

const sslOriginUrl = {}

const handleHTTP = (req, res) => {
  if (/\/---zokor---\//.test(req.url) || req.headers['host'] === 'zokor.me') {
    req.url = req.url.replace(/https?:\/\/.*?\/|\/---zokor---\//, '/')
    serveApi(req, res)
  } else if (!/^https?:\/\//i.test(req.url)) {
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
  sock.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: zokor\r\n\r\n')

  const [domain, port = '443'] = req.url.split(':')
  const startBuffer = [head]
  const timeout = setTimeout(() => {
    sock.end()
  }, 1000)
  sock.once('data', (peek) => {
    clearTimeout(timeout)
    startBuffer.push(peek)
    peek = peek.toString()
    if (!Store.config.parseHTTPS || /connection:\s*upgrade/i.test(peek) || /upgrade:\s*websocket/.test(peek)) {
      beginDirect()
    } else {
      beginSSL()
    }
  })

  const beginSSL = () => {
    IPC.request('get-ssl-tunnel-port', certDomain(domain))
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

  const beginDirect = () => {
    doTunnel(connectTCP(port, domain))
  }

  const doTunnel = tunnel => {
    pipeOnConnect(sock, tunnel, () => {
      startBuffer.forEach(chunk => tunnel.write(chunk))
    })
  }
  return
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


