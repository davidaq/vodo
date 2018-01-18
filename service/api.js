import { parse } from 'url'
import { open, close, read as readFD, stat, exists, createReadStream } from 'fs'
import { clearInterval } from 'timers';
import fileType from 'file-type'
import isSvg from 'is-svg'
import isUtf8 from 'isutf8'
import deepmerge from 'deepmerge'

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
  case '/zokor.cer':
    cert(req, res)
    break
  case '/appdata':
    appdata(req, res)
    break
  case '/read':
    read(req, res)
    break
  case '/examine':
    examine(req, res)
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
      <title>Zokor</title>
    </head>
    <body>
      <div>
        <a href="zokor.cer">${L('Download SSL Certificate')}</a>
      </div>
    </body>
  </html>
  `)
}

function cert (req, res) {
  if (Store.tmp.rootCA) {
    const fname = `zokor.${new Date(Store.tmp.rootCA.time).toString()}.cer`
    res.writeHead(200, {
      'Content-Type': 'application/certificate',
      'Content-Disposition': 'attachment; filename=' + fname
    })
    res.end(Store.tmp.rootCA.cer)
  } else {
    res.writeHead(404)
    res.end('Root CA not ready')
  }
}

function appdata (req, res) {
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
    const ret = Object.assign({}, Store)
    delete ret.tmp
    res.end(JSON.stringify(ret))
  }
}

// read user data
function read (req, res) {
  if (req.query.search) {
    const fname = userDir(req.query.search.substr(1).replace(/[\/\\]/g, '')) || 'x'
    exists(fname, ok => {
      if (ok) {
        res.writeHead(200, req.corsHeaders)
        const reader = createReadStream(fname)
        reader.pipe(res)
        reader.on('error', () => res.end())
      } else {
        res.writeHead(404, req.corsHeaders)
        res.end(JSON.stringify({
          code: 404,
          error: 'not found',
          message: 'file trying to read does not exist'
        }))
      }
    })
  } else {
    res.writeHead(400, req.corsHeaders)
    res.end(JSON.stringify({
      code: 400,
      error: 'missing input',
      message: 'must provide file to read'
    }))
  }
}

// try to examine user data file type
function examine (req, res) {
  if (req.query.search) {
    const fname = userDir(req.query.search.substr(1).replace(/[\/\\]/g, '')) || 'x'
    stat(fname, (err, info) => {
      if (!err || !info.isFile()) {
        const examineAsWhole = (buffer) => {
          let beginChar
          for (let i = 0; i < buffer.length; i++) {
            const b = buffer[i]
            if (b !== 0x9 && b !== 0x10 && b !== 0x13 && b !== 0x20) {
              beginChar = String.fromCharCode(b)
              break
            }
          }
          console.log(beginChar)
          if (beginChar === '<') {
            if (isSvg(buffer)) {
              result('image/svg+xml')
              return
            }
          } else if (beginChar === '[' || beginChar === '{') {
            try {
              console.log(buffer.toString())
              JSON.parse(buffer)
            } catch (err) {
              result('application/json')
              return
            }
          } else if (isUtf8(buffer)) {
            result('text/plain')
            return
          }
          result('unknown/unmatched')
        }
        const examineHeadChunk = () => {
          if (info.size === 0) {
            result('unknown/empty')
            return
          }
          open(fname, 'r', (err, fd) => {
            if (err) {
              console.error(err.message)
              result('unknown/error')
            } else {
              const buffer = Buffer.alloc(4100)
              readFD(fd, buffer, 0, 4100, 0, (err, readLen, headBuffer) => {
                const match = fileType(headBuffer)
                if (match) {
                  result(match.mime)
                  close(fd, err => null)
                } else if (info.size > 1024 * 1024) {
                  result('unknown/large')
                  close(fd, err => null)
                } else {
                  const remainSize = info.size - 4100
                  if (remainSize > 0) {
                    const extBuffer = Buffer.alloc(remainSize)
                    readFD(fd, extBuffer, 0, remainSize, 4100, (err, readLen, remainBuffer) => {
                      close(fd, err => null)
                      if (err) {
                        console.error(err.message)
                        result('unknown/error')
                      } else {
                        examineAsWhole(Buffer.concat([headBuffer, remainBuffer]))
                      }
                    })
                  } else {
                    close(fd, err => null)
                    examineAsWhole(headBuffer)
                  }
                }
              })
            }
          })
        }
        const result = (type) => {
          res.writeHead(200, req.corsHeaders)
          res.end(JSON.stringify({
            size: info.size,
            mime: type
          }))
        }
        examineHeadChunk()
      } else {
        res.writeHead(404, req.corsHeaders)
        res.end(JSON.stringify({
          code: 404,
          error: 'not found',
          message: 'file trying to read does not exist'
        }))
      }
    })
  } else {
    res.writeHead(400, req.corsHeaders)
    res.end(JSON.stringify({
      code: 400,
      error: 'missing input',
      message: 'must provide file to read'
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
        <title>Zokor Captured Events</title>
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
            data[1].maybeJSON = data[1].maybeJSON ? 'yes' : 'no'
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
  req.socket.on('close', () => {
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

