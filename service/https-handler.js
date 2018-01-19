import { connect as connectSSL, createServer as createServerSSL } from 'tls'
import { Server as HttpServer } from 'http'
import { parse } from 'url'
import { connect as connectTCP } from 'net'
import { handleHTTP } from './http-handler'

let robin = 0

export function main () {
  const sslOriginUrl = {}
  IPC.answer('ssl-tunnel-port', (domain) => {
    console.error(`Open SSL tunnel for ${domain}`)
    return IPC.request('gen-ssl-cert', domain)
    .then(tlsOptions => {
      const tunnel = createTunnel(tlsOptions, sslOriginUrl)
      return new Promise(resolve => {
        tunnel.listen(0, '127.0.0.1', () => {
          const port = tunnel.address().port
          IPC.answer(`ssl-origin-url:${port}`, ({ port, url}) => {
            sslOriginUrl[port] = url
          })
          resolve(port)
        })
      })
    })
  })
}

const createTunnel = (tlsOptions, sslOriginUrl) => {
  const mockHTTP = new HttpServer((req, res) => {
    req.url = `https://${sslOriginUrl[req.socket.remotePort]}${req.url}`
    handleHTTP(req, res)
  })
  return createServerSSL(tlsOptions, sock => {
    const ports = Store.tmp.httpWorkers
    if (ports.length === 0) {
      sock.end()
    } else {
      sock.once('data', peekChunk => {
        const peek = peekChunk.toString() 
        if (/connection:\s*upgrade/i.test(peek) || /upgrade:\s*websocket/.test(peek)) {
          const [domain, port = '443'] = sslOriginUrl[sock.remotePort].split(':')
          pipeOnConnect(sock, connectSSL(port, domain), () => {
            tunnel.write(peekChunk)
          })
        } else {
          mockHTTP.emit('connection', sock)
          sock.unshift(peekChunk)
          sock.resume()
        }
      })
    }
  })
}
