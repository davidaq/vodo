import { createServer } from 'http'
import { parse } from 'url'
import { serve as serveApi } from './api'
import { serve as serveProxy } from './proxy'
import { connectSSLTunnel } from './ssl-tunnel'

const handler = (req, res) => {
  let { url } = req
  if (!/https?:\/\//i.test(url)) {
    url = `http://api${url}`
  }
  req.parsedUrl = parse(url)
  if (req.parsedUrl.hostname === 'api') {
    serveApi(req, res)
  } else {
    serveProxy(req, res)
  }
}

const server = createServer(handler)

const onConnect = () => {
  const { port } = server.address()
  console.error(`Background service started on port ${port}`)
  if (process.sendMessage) {
    process.send({
      type: 'SERVICE_STARTED',
      port
    })
  }
}

server.listen(process.env.PORT || Store.config.basic.port, '0.0.0.0', onConnect)
server.on('connect', connectSSLTunnel)

for (let i = 0; i < 4; i++) {
  IPC.start({ SERVICE: 'gen-ssl' })
  IPC.start({ SERVICE: 'proxy' })
}
