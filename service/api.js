import { parse } from 'url'
import { open, close, read as readFD, stat, exists, createReadStream } from 'fs'
import deepmerge from 'deepmerge'
import { getRootCertPair } from './ssl-cert'
import { examine } from './mime'
import qs from 'qs'

export const serve = (req, res) => {
  req.corsHeaders = {
    'Access-Control-Allow-Origin': req.headers['origin'] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-vodo-no-record'
  }
  if (req.method === 'options') {
    res.writeHead(200, req.corsHeaders)
    res.end()
  }
  req.query = parse(req.url)
  switch (req.query.pathname) {
  case '/':
    console.log('/', req.headers['host'])
    if (req.headers['host'] && !/vo\.do/.test(req.headers['host'])) {
      console.log('red')
      res.writeHead(302, {
        'Location': `http://vo.do${req.url}`
      })
      res.end()
    } else {
      html('api-home.html', req, res)
    }
    break
  case '/inject.js':
    injectScript(req, res)
    break
  case '/vodo.cer':
    cert(req, res)
    break
  case '/app-data':
    appData(req, res)
    break
  case '/get-record':
    getRecord(req, res)
    break
  case '/live':
    html('api-live.html', req, res)
    break
  case '/live-sse':
    live(req, res)
    break
  default:
    res.writeHead(404)
    res.end(`No matching route: ${req.url}`)
  }
}

function html (name, req, res) {
  res.writeHead(200, Object.assign({
    'content-type': 'text/html; charset=utf-8',
  }, req.corsHeaders))
  createReadStream(assetsDir(name)).pipe(res)
}

function injectScript (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
  })
  res.end(Store.htmlInjectScript)
}

function cert (req, res) {
  const rootPair = getRootCertPair()
  const fname = `vodo.${rootPair.hash}.cer`
  res.writeHead(200, {
    'Content-Type': 'application/certificate',
    'Content-Disposition': 'attachment; filename=' + fname
  })
  res.end(rootPair.cer)
}

function appData (req, res) {
  res.writeHead(200, req.corsHeaders)
  if (req.method.toLowerCase() === 'put') {
    const buffer = []
    req.on('data', chunk => {
      buffer.push(chunk)
    })
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(buffer))
        const changed = /\?shallow/.test(req.url)
        ? body
        : deepmerge(
          Store,
          body,
          {
            arrayMerge: (a, b) => b
          }
        )
        Object.assign(Store, changed)
        res.end('true')
      } catch (err) {
        res.end('false')
      }
    })
  } else {
    res.end(JSON.stringify(Store))
  }
}

// read request record
function getRecord (req, res) {
  const query = {}
  if (req.query.search) {
    Object.assign(query, qs.parse(req.query.search.substr(1)))
  }
  if (query.requestID) {
    const notFound = () => {
      res.writeHead(404, req.corsHeaders)
      res.end(JSON.stringify({
        code: 404,
        error: 'not found',
        message: 'request record not found'
      }))
    }
    if (query.field) {
      IPC.request('get-record-field', query.requestID, query.field)
      .then(({ result, examined }) => {
        result = `${result}`
        if (result && !examined) {
          examined = examine(new Buffer(result, 'binary'))
          IPC.request('record-request', query.requestID, {
            [`${query.field}:examined`]: examined
          })
        }
        if (query.examine) {
          res.writeHead(200, { 'content-type': 'text/plain', ...req.corsHeaders })
          res.end(examined)
        } else {
          res.writeHead(200, { 'content-type': examined || 'text/plain', ...req.corsHeaders })
          res.end(new Buffer(result, 'binary'))
        }
      }, notFound)
    } else {
      IPC.request('get-record', query.requestID)
      .then(result => {
        res.writeHead(200, req.corsHeaders)
        res.end(JSON.stringify(result))
      }, notFound)
    }
  } else {
    res.writeHead(400, req.corsHeaders)
    res.end(JSON.stringify({
      code: 400,
      error: 'missing input',
      message: 'must provide requestID'
    }))
  }
}

function live (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    ...req.corsHeaders
  })
  const cleanup = []
  req.on('close', () => {
    cleanup.forEach(fn => fn())
  })
  const keepalive = setInterval(() => {
    res.write(`event: keepalive\r\ndata: null\r\n\r\n`)
  }, 5000)
  cleanup.push(() => clearInterval(keepalive))
  const subscribe = (eventName, sendName, dataFn) => {
    const cb = (...args) => {
      const data = dataFn ? dataFn(...args) : JSON.stringify(args)
      res.write(`event: ${sendName}\r\ndata: ${data}\r\n\r\n`)
    }
    IPC.on(eventName, cb)
    cleanup.push(() => {
      IPC.removeListener(eventName, cb)
    })
  }
  subscribe('caught-request-begin', 'begin')
  subscribe('caught-request-respond', 'respond')
  subscribe('caught-request-finish', 'finish')
  subscribe('caught-request-error', 'error')
  subscribe('store-sync', 'store', (hash, content) => content)
  res.write(`event: store\r\ndata: ${JSON.stringify(Store)}\r\n\r\n`)
}

