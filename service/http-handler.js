import { createServer } from 'http'
import { connect as connectTCP } from 'net'
import { serve as serveApi } from './api'
import { certDomain } from './ssl-cert'
import { handleProxy } from './proxy-handler'

export const handleHTTP = (req, res) => {
  if (/\/---zokor---\//.test(req.url)) {
    const pos = req.url.indexOf('/---zokor---/')
    req.url = req.url.substr(pos + '/---zokor---'.length)
    serveApi(req, res)
  } else if (req.headers['host'] === 'tt.tt') {
    req.url = req.url.replace(/https?:\/\/.*?\//g, '/')
    serveApi(req, res)
  } else if (!/^https?:\/\//i.test(req.url)) {
    serveApi(req, res)
  } else {
    handleProxy(req, res)
  }
}

const connectSSLTunnel = (req, sock, head) => {
  sock.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: zokor\r\n\r\n')

  const [domain, port = '443'] = req.url.split(':')
  const startBuffer = [head]

  const doTunnel = tunnel => {
    pipeOnConnect(sock, tunnel, () => {
      startBuffer.forEach(chunk => tunnel.write(chunk))
    })
  }

  const beginSSL = () => {
    IPC.request('get-ssl-tunnel-port', certDomain(domain))
    .then(port => {
      const sock = connectTCP(port, '127.0.0.1')
      sock.on('connect', () => {
        IPC.request(`ssl-origin-url:${port}`, {
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

  if (Store.config.parseHTTPS) {
    const timeout = setTimeout(() => {
      beginDirect()
    }, 200)
    sock.once('data', (peek) => {
      clearTimeout(timeout)
      startBuffer.push(peek)
      if (peek[0] === 22) {
        beginSSL()
      } else {
        beginDirect()
      }
    })
  } else {
    beginDirect()
  }
}

export function main () {
  const httpServer = createServer(handleHTTP)
  httpServer.on('connect', connectSSLTunnel)
  httpServer.listen(0, '127.0.0.1', () => {
    const { port } = httpServer.address()
    IPC.request('register-http-worker', port)
  })
}


