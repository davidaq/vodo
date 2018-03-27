import { createServer } from 'http'
import { parse as parseurl } from 'url'
import { connect as connectTCP } from 'net'
import { serve as serveApi } from './api'
import { certDomain } from './ssl-cert'
import { handleProxy } from './proxy-handler'

export const handleHTTP = (req, res) => {
  if (/\/---vodo---\//.test(req.url)) {
    const pos = req.url.indexOf('/---vodo---/')
    req.url = req.url.substr(pos + '/---vodo---'.length)
    serveApi(req, res)
  } else if (req.headers['host'] === 'vo.do') {
    req.url = req.url.replace(/https?:\/\/.*?\//g, '/')
    serveApi(req, res)
  } else if (req.headers['host'] === 'v.o.d.o') {
    res.writeHead(200, { 'access-control-allow-origin': '*' })
    res.end('VODO, IT WORKS')
  } else if (!/^https?:\/\//i.test(req.url)) {
    serveApi(req, res)
  } else {
    handleProxy(req, res)
  }
}

const connectSSLTunnel = (req, sock, head) => {
  sock.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: vodo\r\n\r\n')

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
    if (Store.config.recordRequest) {
      const options = parseurl(`tcp://${domain}:${port}/*`)
      options.requestID = ID()
      options.method = 'DIRECT'
      options.statusCode = 0
      options.statusMessage = 'Not Parsed'
      options.startTime = Date.now()
      options.responseTime = Date.now()
      options.responseElapse = 0
      options.finishTime = Date.now()
      options.finishElapse = 0
      options.headers = {}
      options.responseHeaders = {}
      options.requestBodySize = 0
      options.responseBodySize = 0
      options.requestBody = ''
      options.responseBody = ''
      IPC.request('record-request', options.requestID, options)
      IPC.emit('caught-request-begin', {
        requestID: options.requestID,
        startTime: options.startTime,
        protocol: options.protocol,
        hostname: options.hostname,
        port: options.port,
        method: options.method,
        pathname: options.pathname
      })
      IPC.emit('caught-request-finish', options.requestID, { size: 0, finishElapse: 0 })
    }
    doTunnel(connectTCP(port, domain))
  }

  // redirect traffic to https handler only if
  // the config switch is on and the connect is SSL
  if (!Store.config.ignoreHTTPS || domain === 'vo.do' || domain === 'v.o.d.o') {
    const timeout = setTimeout(beginDirect, 200)
    sock.once('data', (peek) => {
      clearTimeout(timeout)
      startBuffer.push(peek)
      if (peek[0] === 0x16) {   // 0x16: handshake starter for SSL
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


