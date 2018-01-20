import { parse } from 'url'
import { open, close, read as readFD, stat, exists, createReadStream } from 'fs'
import deepmerge from 'deepmerge'
import { getRootCertPair } from './ssl-cert'
import { examine } from './mime'

export const serve = (req, res) => {
  req.corsHeaders = {
    'Access-Control-Allow-Origin': req.headers['origin'] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
  if (req.method === 'options') {
    res.writeHead(200, req.corsHeaders)
    res.end()
  }
  req.query = parse(req.url)
  switch (req.query.pathname) {
  case '/':
    home(req, res)
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
    if (/text\/event-stream/.test(req.headers['accept'])) {
      liveSSE(req, res)
    } else {
      liveHTML(req, res)
    }
    break
  default:
    res.writeHead(404)
    res.end(`No matching route: ${req.url}`)
  }
}

function home (req, res) {
  res.writeHead(200, Object.assign({
    'content-type': 'text/html; charset=utf-8',
  }, req.corsHeaders))
  res.end(`
  <!DOCTYPE>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
      <title>vodo</title>
    </head>
    <body>
      <div>
        <a href="vodo.cer">${L('Download SSL Certificate')}</a>
      </div>
    </body>
  </html>
  `)
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
        const changed = deepmerge(
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
    req.query.search.substr(1).split('&').forEach(field => {
      const [key, val] = field.split('=')
      query[decodeURIComponent(key)] = decodeURIComponent(val)
    })
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
          res.writeHead(200, Object.assign({ 'content-type': 'text/plain' }, req.corsHeaders))
          res.end(examined)
        } else {
          res.writeHead(200, Object.assign({ 'content-type': examined || 'text/plain' }, req.corsHeaders))
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

function liveHTML (req, res) {
  res.writeHead(200, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
  }))
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vodo Captured Events</title>
        <meta charset="utf-8">
        <style>
          td {
            max-width: 350px;
            word-break: break-all;
          }
          tr:hover td {
            background: #EEE;
          }
        </style>
      </head>
      <body>
        <table border="1" cellspacing="1" cellpadding="5">
          <thead>
            <tr id="header">
            </tr>
          </thead>
          <tbody id="tbody">
          </tbody>
        </table>
        <script>
          var ev = new EventSource(location.href);
          var store = {};
          var headers = [];
          var headered = {};
          function updateUI (item) {
            item.el.innerHTML = ''
            var headerChanged = false;
            Object.keys(item.data).forEach(function (key) {
              if (!headered[key]) {
                headerChanged = true;
                headers.push(key);
                headered[key] = true;
              }
            });
            document.getElementById('header').innerHTML = headers.map(function (v) { return '<th>' + v + '</th>' }).join('');
            item.el.innerHTML = headers.map(function (v) { return '<td>' + (item.data[v] || '') + '</td>' }).join('');
          }
          ev.addEventListener('begin', function (event) {
            var data = JSON.parse(event.data)[0];
            var el = document.createElement('tr');
            data.state = 'requesting'
            store[data.requestID] = { data: data, el: el };
            updateUI(store[data.requestID]);
            document.getElementById('tbody').appendChild(el);
          });
          ev.addEventListener('respond', function (event) {
            var requestID = JSON.parse(event.data)[0];
            store[requestID].data.state = 'receiving';
            updateUI(store[requestID]);
          });
          ev.addEventListener('finish', function (event) {
            var data = JSON.parse(event.data)
            var requestID = data[0];
            data[1].size = (data[1].size / 1024).toFixed(2) + 'KB'
            store[requestID].data.state = 'finished';
            Object.assign(store[requestID].data, data[1])
            updateUI(store[requestID]);
            delete store[requestID];
          });
          ev.addEventListener('error', function (event) {
            var data = JSON.parse(event.data)
            var requestID = data[0];
            store[requestID].data.state = 'error';
            store[requestID].data.error = data[1];
            updateUI(store[requestID]);
            delete store[requestID];
          });
        </script>
      </body>
    </html>
  `)
}

function liveSSE (req, res) {
  res.writeHead(200, Object.assign({
    'Content-Type': 'text/event-stream; charset=utf-8',
  }, req.corsHeaders))
  const cleanup = []
  req.on('close', () => {
    cleanup.forEach(fn => fn())
  })
  const keepalive = setInterval(() => {
    res.write(`event: keepalive\r\ndata: null\r\n\r\n`)
  }, 15000)
  cleanup.push(() => clearInterval(keepalive))
  const subscribe = (eventName, sendName) => {
    const cb = (...args) => {
      res.write(`event: ${sendName}\r\ndata: ${JSON.stringify(args)}\r\n\r\n`)
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
}

