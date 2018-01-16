import { createServer } from 'https'
import { parse } from 'url'
import { connect as connectTCP } from 'net'
import { serve as serveProxy } from './proxy'

const pool = {}
const pipe = {}

const domainSuffix = {}
readAssets('domain-suffix.txt').toString().split('\n').forEach(v => {
  if (v) {
    domainSuffix[`.${v.trim()}`] = true
  }
})

export const getTunnelFor = (url, cb) => {
  const [domain, port = '443'] = url.split(':')
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
  if (!pool[certDomain]) {
    pool[certDomain] = new Promise(resolve => {
      console.error(`Open SSL tunnel for ${certDomain}`)
      IPC.request('gen-ssl-pair', certDomain)
      .then(options => {
        const tunnel = createServer(options, (req, res) => {
          setTimeout(() => {
            const { url } = pipe[req.socket.remotePort]
            req.url = `https://${url.replace(/\:443$/, '')}${req.url}`
            req.parsedUrl = parse(req.url)
            serveProxy(req, res)
          }, 10)
        })
        tunnel.listen(0, '127.0.0.1', () => {
          resolve(tunnel.address().port)
        })
      })
    })
  }
  pool[certDomain].then(port => {
    const sock = connectTCP(port)
    sock.on('connect', () => {
      pipe[sock.localPort] = { url }
    })
    cb(sock)
  })
}

export const connectSSLTunnel = (req, sock, head) => {
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
  getTunnelFor(req.url, doTunnel)
}
