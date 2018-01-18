import { connect as connectTCP, createServer } from 'net'
import { ensureRootCA } from './gen-ssl'

ensureRootCA()

for (let i = 0; i < 4; i++) {
  IPC.start({ SERVICE: 'gen-ssl' })
  IPC.start({ SERVICE: 'ssl-tunnel' })
  IPC.start({ SERVICE: 'http-handler' })
}

IPC.answer('register-http-worker', (port) => {
  Store.tmp.httpWorkers.push(port)
})

const sslTunnelPool = {}
IPC.answer('get-ssl-tunnel-port', (domain) => {
  if (!sslTunnelPool[domain]) {
    sslTunnelPool[domain] = IPC.request('ssl-tunnel-port', domain)
  }
  return sslTunnelPool[domain]
})

let requestID = 0
let cycleID = 0
let requestSize = 0
IPC.answer('request-id', () => {
  requestID++
  cycleID++
  return { requestID, cycleID }
})
IPC.on('caught-request-finish', (requestID, { size }) => {
  const limit = Store.config.saveRequestLimit * 1024 * 1024
  if (size > limit / 10) {
    size = limit / 10
  }
  requestSize += size
  if (requestSize > limit) {
    cycleID = 0
    requestSize = 0
  }
})

let robin = 0

const handleLoad = (sock) => {
  const ports = Store.tmp.httpWorkers
  if (ports.length === 0) {
    sock.end()
  } else {
    const port = ports[robin]
    robin = (robin + 1) % ports.length
    pipeOnConnect(sock, connectTCP(port))
  }
}

const loadBalancedServer = createServer({ allowHalfOpen: true }, handleLoad)

const onStartup = () => {
  const { port } = loadBalancedServer.address()
  console.error(`Background service started on port ${port}`)
}
loadBalancedServer.listen(process.env.PORT || Store.config.port, onStartup)

