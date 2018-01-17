import { parse } from 'url'
import { clearInterval } from 'timers';

export const serve = (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': req.headers['origin'],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
  if (req.method === 'options') {
    res.writeHead(200, cors)
    res.end()
  }
  const query = parse(req.url)
  switch (query.pathname) {
  case '/live':
    if (/^text\/html/.test(req.headers['accept'])) {
      res.writeHead(200, Object.assign({
        'Content-Type': 'text/html; charset=utf-8',
      }))
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Zokor Captured Events</title><meta charset="utf-8"></head>
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
              var ev = new EventSource('/live');
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
                store[requestID].data.state = 'finished';
                store[requestID].data.size = (data[1] / 1024).toFixed(2) + 'KB';
                store[requestID].data.maybeJSON = data[2] ? 'yes' : 'no';
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
    } else {
      res.writeHead(200, Object.assign({
        'Content-Type': 'text/event-stream; charset=utf-8',
      }, cors))
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
    break
  default:
    res.writeHead(404)
    res.end(`No matching route: ${req.url}`)
  }
}

