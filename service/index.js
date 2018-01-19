import { connect as connectTCP, createServer } from 'net'
import { ensureRootCA } from './ssl-cert'
import { main as singleTruthService } from './single-truth'

export function main () {
  ensureRootCA()
  singleTruthService()

  let robin = 0
  const httpWorkers = []

  IPC.answer('register-http-worker', (port) => {
    httpWorkers.push(port)
  })

  const handleLoad = (sock) => {
    if (httpWorkers.length === 0) {
      sock.end()
    } else {
      const port = httpWorkers[robin]
      robin = (robin + 1) % httpWorkers.length
      pipeOnConnect(sock, connectTCP(port))
    }
  }

  const loadBalancedServer = createServer({ allowHalfOpen: true }, handleLoad)

  const onStartup = () => {
    const { port } = loadBalancedServer.address()
    console.error(`Background service started on port ${port}`)
  }
  loadBalancedServer.listen(process.env.PORT || Store.config.port, onStartup)

  IPC.start({ SERVICE: 'ssl-cert' }, 2)
  IPC.start({ SERVICE: 'https-handler' }, 3)
  IPC.start({ SERVICE: 'http-handler' }, 3)
}
