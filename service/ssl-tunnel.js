import { createServer } from 'tls'
import { parse } from 'url'
import { connect as connectTCP } from 'net'

const pipe = {}

const domainSuffix = {}

export function certDomain (domain) {
  if (!domainSuffix['*']) {
    domainSuffix['*'] = true
    readAssets('domain-suffix.txt').toString().split('\n').forEach(v => {
      if (v) {
        domainSuffix[`.${v.trim()}`] = true
      }
    })
  }
  const domainParts = domain.split('.')
  let certDomain = ''
  for (let i = domainParts.length - 1; i >= 0; i--) {
    certDomain = `.${domainParts[i]}${certDomain}`
    if (!domainSuffix[certDomain]) {
      break
    }
  }
  if (certDomain !== `.${domain}`) {
    certDomain = `*${certDomain}`
  } else {
    certDomain = domain
  }
  return certDomain
}

let robin = 0

if (process.env.SERVICE === 'ssl-tunnel') {
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
          const port = ports[robin]
          robin = (robin + 1) % ports.length
          const worker = connectTCP(port, '127.0.0.1')
          worker.on('connect', () => {
            IPC.request(`ssl-origin-url-t2:${port}`, {
              port: worker.localPort,
              url: sslOriginUrl[sock.remotePort]
            })
            delete sslOriginUrl[sock.remotePort]
            sock.pipe(worker)
            worker.pipe(sock)
          })
          sock.on('error', () => worker.end())
          worker.on('error', () => sock.end())
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

