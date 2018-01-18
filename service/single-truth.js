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

const recordedRequests = {}
const recordedRequestsList = []
let recordedBodySize = 0
let truncatedRecordNum = 0

IPC.answer('record-request', (requestID, data) => {
  try {
    if (!recordedRequests[requestID]) {
      recordedRequestsList.push(requestID)
      recordedRequests[requestID] = data
    } else {
      const record = recordedRequests[requestID]
      if (record.isTrucated) {
        delete data.requestBody
        delete data.responseBody
      }
      Object.assign(record, data)
    }
    if (data.requestBody) {
      recordedBodySize += data.requestBody.length
    }
    if (data.responseBody) {
      recordedBodySize += data.responseBody.length
    }
    const limit = Store.config.allRequestLimit * 1024 * 1024
    while (recordedBodySize > limit && truncatedRecordNum < recordedRequestsList.length) {
      const record = recordedRequests[recordedRequestsList[truncatedRecordNum]]
      record.isTrucated = true
      if (record.requestBody) {
        recordedBodySize -= record.requestBody.length
      }
      if (record.responseBody) {
        recordedBodySize -= record.responseBody.length
      }
      truncatedRecordNum++
    }
  } catch (err) {
    console.error(err.stack)
  }
})
