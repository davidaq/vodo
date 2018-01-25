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
    if (process.env.PORT) {
      Store.config.port = port
    }
    if (process.send) {
      process.send({ type: 'listening', port })
    }
    IPC.start({ SERVICE: 'ssl-cert' }, 2)
    IPC.start({ SERVICE: 'https-handler' }, 3)
    IPC.start({ SERVICE: 'http-handler' }, 3)
  }
  loadBalancedServer.listen(process.env.PORT || Store.config.port, onStartup)

  const getMyAddress = () => {
    const trySite = ['baidu.com', 'github.com', 'bing.com', 'aliyun.com', 'npmjs.org']
    const site = trySite[Math.floor(Math.random() * trySite.length)]
    const conn = connectTCP(80, site, () => {
      Store.addr = conn.address().address
      console.log(Store.addr)
      conn.end(`GET / HTTP/1.0\r\nHost: ${site}\r\n\r\n`)
      conn.resume()
      setTimeout(getMyAddress, 600000)
    })
    conn.on('error', err => setTimeout(getMyAddress, 5000))
  }
  getMyAddress()
}

