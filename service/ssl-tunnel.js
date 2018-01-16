import { createServer } from 'https'
import { parse } from 'url'
import { connect as connectTCP } from 'net'

const pool = {}
const pipe = {}

export const getTunnelFor = (url, requestHandler, cb) => {
  const [domain, port = '443'] = url.split(':')
  const domainParts = domain.split('.')
  let certDomain = domain
  if (domainParts.length > 3) {
    certDomain =  `*.${domainParts.slice(domainParts.length - 3).join('.')}`
  }
  if (!pool[certDomain]) {
    pool[certDomain] = new Promise(resolve => {
      console.error(`Open SSL tunnel for ${certDomain}`)
      IPC.request('gen-ssl-pair', domain)
      .then(options => {
        const tunnel = createServer(options, (req, res) => {
          setTimeout(() => {
            const { url, requestHandler } = pipe[req.socket.remotePort]
            req.url = `https://${url.replace(/\:443$/, '')}${req.url}`
            req.parsedUrl = parse(req.url)
            requestHandler(req, res)
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
      pipe[sock.localPort] = { url, requestHandler }
    })
    cb(sock)
  })
}

for (let i = 0; i < 4; i++) {
  IPC.start({ SERVICE: 'gen-ssl' })
}

