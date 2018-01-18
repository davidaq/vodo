import { request } from "https";


IPC.answer('register-http-worker', (port) => {
  Store.tmp.httpWorkers.push(port)
})

const sslTunnelPool = {}
IPC.answer('get-ssl-tunnel-port', (domain) => {
  if (!sslTunnelPool[domain]) {
    sslTunnelPool[domain] = IPC.request('ssl-tunnel-port', domain)
  }
  return sslTunnelPool[domain]
})

let requestID = 0
let cycleID = 0
let requestSize = 0
IPC.answer('request-id', () => {
  requestID++
  cycleID++
  return { requestID, cycleID }
})
IPC.on('caught-request-finish', (requestID, { size }) => {
  const limit = Store.config.saveRequestLimit * 1024 * 1024
  if (size > limit / 10) {
    size = limit / 10
  }
  requestSize += size
  if (requestSize > limit) {
    cycleID = 0
    requestSize = 0
  }
})

const recordedRequests = {}

IPC.answer('record-request', (requestID, data) => {
  if (!recordedRequests[requestID]) {
    recordedRequests[requestID] = data
  } else {
    Object.assign(recordedRequests[requestID], data)
  }
})
