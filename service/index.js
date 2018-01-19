import { connect as connectTCP, createServer } from 'net'
import { ensureRootCA } from './gen-ssl'
import { main as singleTruthService } from './single-truth'

export function main () {
  ensureRootCA()
  singleTruthService()

  for (let i = 0; i < 4; i++) {
    IPC.start({ SERVICE: 'gen-ssl' })
    IPC.start({ SERVICE: 'ssl-tunnel' })
    IPC.start({ SERVICE: 'http-handler' })
  }

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
