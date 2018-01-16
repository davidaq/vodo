import { createServer } from 'http'
import { parse } from 'url'
import { serve as serveApi } from './api'
import { serve as serveProxy, connect } from './proxy'

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
server.on('connect', connect)

