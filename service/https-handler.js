import { connect as connectSSL, createServer as createServerSSL } from 'tls'
import { Server as HttpServer } from 'http'
import { parse } from 'url'
import { connect as connectTCP } from 'net'
import { handleHTTP } from './http-handler'

const sslOriginUrl = {}

export function main () {
  IPC.answer('ssl-tunnel-port', (domain) => {
    console.error(`Open SSL handler for ${domain}`)
    return IPC.request('gen-ssl-cert', domain)
    .then(tlsOptions => {
      const handler = createHandler(tlsOptions)
      return new Promise(resolve => {
        handler.listen(0, '127.0.0.1', () => {
          const port = handler.address().port
          IPC.answer(`ssl-origin-url:${port}`, ({ port, url}) => {
            sslOriginUrl[port] = url
          })
          resolve(port)
        })
      })
    })
  })
}

const createHandler = (tlsOptions) => {
  const mockHTTP = new HttpServer((req, res) => {
    req.url = `https://${sslOriginUrl[req.socket.remotePort]}${req.url}`
    handleHTTP(req, res)
  })
  return createServerSSL(tlsOptions, sock => {
    // peek to check if request is websocket
    sock.on('error', () => null)
    sock.once('data', peekChunk => {
      sock.pause()
      setTimeout(() => {
        const peek = peekChunk.toString()
        if (/connection:\s*upgrade/i.test(peek) || /upgrade:\s*websocket/.test(peek)) {
          // for now just proxy the trafic directly to the target server
          const [domain, port = '443'] = sslOriginUrl[sock.remotePort].split(':')
          const tunnel = connectSSL(port, domain)
          pipeOnConnect(sock, tunnel, () => {
            tunnel.write(peekChunk)
          })
        } else {
          try {
            mockHTTP.emit('connection', sock)
          } catch (err) {
            console.error(err.stack)
            sock.on('error', () => null)
            sock.end()
          }
          sock.unshift(peekChunk)
          sock.resume()
        }
      }, 50)
    })
  })
}
