import { connect as connectTCP, createServer } from 'net'

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
    sslTunnelPool[domain] = IPC.request('gen-ssl-tunnel-port', domain)
  }
  return sslTunnelPool[domain]
})

let robin = 0

const handleLoad = (sock) => {
  const ports = Store.tmp.httpWorkers
  if (ports.length === 0) {
    sock.end()
  } else {
    const port = ports[robin]
    robin = (robin + 1) % ports.length
    const worker = connectTCP(port)
    worker.on('connect', () => {
      sock.pipe(worker)
      worker.pipe(sock)
    })
    sock.on('error', () => worker.end())
    worker.on('error', () => sock.end())
  }
}

const loadBalancedServer = createServer({ allowHalfOpen: true }, handleLoad)

const onStartup = () => {
  const { port } = loadBalancedServer.address()
  console.error(`Background service started on port ${port}`)
}
loadBalancedServer.listen(process.env.PORT || Store.config.basic.port, onStartup)

