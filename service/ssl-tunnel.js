import { connect as connectSSL, createServer } from 'tls'
import { parse } from 'url'
import { connect as connectTCP } from 'net'

let robin = 0

export function main () {
  const sslOriginUrl = {}
  IPC.answer('ssl-tunnel-port', (domain) => {
    console.error(`Open SSL tunnel for ${domain}`)
    return IPC.request('gen-ssl', domain)
    .then(options => {
      options.allowHalfOpen = true
      const tunnel = createServer(options, sock => {
        const ports = Store.tmp.httpWorkers
        if (ports.length === 0) {
          sock.end()
        } else {
          sock.once('data', peekChunk => {
            const peek = peekChunk.toString() 
            const doTunnel = (tunnel, cb) => {
              pipeOnConnect(sock, tunnel, () => {
                cb && cb()
                tunnel.write(peekChunk)
              })
            }
            if (/connection:\s*upgrade/i.test(peek) || /upgrade:\s*websocket/.test(peek)) {
              const [domain, port = '443'] = sslOriginUrl[sock.remotePort].split(':')
              doTunnel(connectSSL(port, domain))
            } else {
              const port = ports[robin]
              robin = (robin + 1) % ports.length
              const worker = connectTCP(port, '127.0.0.1')
              doTunnel(worker, () => {
                IPC.request(`ssl-origin-url-t2:${port}`, {
                  port: worker.localPort,
                  url: sslOriginUrl[sock.remotePort]
                })
              })
            }
          })
        }
      })
      return new Promise(resolve => {
        tunnel.listen(0, '127.0.0.1', () => {
          const port = tunnel.address().port
          IPC.answer(`ssl-origin-url-t1:${port}`, ({ port, url}) => {
            sslOriginUrl[port] = url
          })
          resolve(port)
        })
      })
    })
  })
}

const domainSuffix = {}

export function certDomain (domain) {
  if (!domainSuffix['*']) {
    domainSuffix['*'] = true
    readAssets('domain-suffix.txt').toString().split('\n').forEach(v => {
      if (v) {
        domainSuffix[`${v.trim()}`] = true
      }
    })
  }
  const domainParts = domain.split('.')
  let certDomain = domainParts.slice(1).join('.')
  if (domainSuffix[certDomain]) {
    certDomain = domain
  } else {
    certDomain = `*.${certDomain}`
  }
  return certDomain
}
