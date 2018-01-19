import { connect as connectTCP, createServer } from 'net'
import { ensureRootCA } from './ssl-cert'
import { main as singleTruthService } from './single-truth'

export function main () {
  ensureRootCA()
  singleTruthService()

  // IPC.start({ SERVICE: 'ssl-cert' }, 2)
  // IPC.start({ SERVICE: 'https-handler' }, 3)
  // IPC.start({ SERVICE: 'http-handler' }, 3)

  IPC.start({ SERVICE: 'ssl-cert' }, 1)
  IPC.start({ SERVICE: 'https-handler' }, 1)
  IPC.start({ SERVICE: 'http-handler' }, 1)

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
}
