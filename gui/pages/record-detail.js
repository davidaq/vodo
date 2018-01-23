import { Tabs } from '../components/form'
import BodyDisplayer from '../components/body-displayer'
import TitleBar from '../components/title-bar'
import { createWriteStream } from 'fs'
import { get as httpGet } from 'http'

@requireWindow
@autobind
class RecordDetail extends Component {
  
  componentWillMount () {
    const { requestID, initState } = this.props
    if (initState) {
      this.setState(initState)
    } else {
      this.setState({ tab: 'basic' })
    }
    this.updateState(requestID)
    eventBus.on('record', this.updateState)
  }

  componentWillUnmount () {
    eventBus.removeListener('record', this.updateState)
  }

  updateState (requestID) {
    if (requestID === this.props.requestID) {
      fetch(`${serviceAddr}/get-record?requestID=${requestID}`)
      .then(r => r.json())
      .then(info => {
        this.setState({ info })
        if (!this.state.requestContentType) {
          Object.keys(info.headers).forEach(key => {
            if (key.toLowerCase() === 'content-type') {
              this.setState({ requestContentType: info.headers[key] })
            }
          })
        }
        if (!this.state.responseContentType && info.responseHeaders) {
          Object.keys(info.responseHeaders).forEach(key => {
            if (key.toLowerCase() === 'content-type') {
              this.setState({ responseContentType: info.responseHeaders[key] })
            }
          })
        }
        if (!this.state.requestBodyMime && info.responseTime) {
          fetch(`${serviceAddr}/get-record?requestID=${requestID}&field=requestBody&examine=1`)
          .then(r => r.text())
          .then(requestBodyMime => {
            this.setState({ requestBodyMime })
          })
        }
        if (!this.state.responseBodyMime && info.finishTime) {
          fetch(`${serviceAddr}/get-record?requestID=${requestID}&field=responseBody&examine=1`)
          .then(r => r.text())
          .then(responseBodyMime => {
            this.setState({ responseBodyMime })
          })
        }
      })
    }
  }

  onOpenWindow () {
    openUI('record-detail', {
      props: { requestID: this.props.requestID, independent: true, initState: this.state },
      width: 500,
      height: 400
    }, win => {
      win.setMinimumSize(400, 300)
    })
  }

  onSave (ev) {
    let ext = this.state.responseBodyMime.split('/')[1]
    if (ext) {
      ext = ext.split('+')[0].split('-').pop()
    }
    if (!ext) {
      ext = 'data'
    }
    const window = this.context.window
    if (window.fileInput) {
      window.fileInput.parentElement.removeChild(window.fileInput)
    }
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.nwsaveas = `vodo-response.${ext}`
    Object.assign(fileInput.style, {
      position: 'absolute',
      top: '-10px',
      left: '-10px',
      width: '1px',
      height: '1px'
    })
    window.document.body.appendChild(fileInput)
    window.fileInput = fileInput
    fileInput.onchange = (ev) => {
      const out = createWriteStream(fileInput.files[0].path)
      out.on('error', err => null)
      const url = `${serviceAddr}/get-record?requestID=${info.requestID}&field=responseBody`
      const req = httpGet(url, res => {
        res.pipe(out)
      })
      req.on('error', err => out.end())
      req.end()
    }
    fileInput.click()
  }

  @CSS({
    '.wrap': {
      display: 'flex',
      flexFlow: 'column',
      height: '100%'
    },
    a: {
      cursor: 'pointer',
      '&:hover': {
        textDecoration: 'underline'
      }
    },
    '.title': {
      flex: 'none'
    },
    '.detail': {
      flex: 'auto',
      padding: 5,
      position: 'relative',
      '&-wrap': {
        position: 'absolute',
        overflowY: 'scroll',
        padding: 5,
        boxSizing: 'border-box',
        top: 0,
        left: 0,
        height: '100%',
        width: '100%'
      }
    },
    '.tabs': {
      textAlign: 'center',
      '.fa': {
        position: 'absolute',
        right: 5,
        top: 6,
        padding: '5px 7px',
        borderRadius: 5,
        cursor: 'pointer',
        transition: 'background 0.3s',
        fontSize: 10,
        '&:hover': {
          background: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    '.section': {
      display: 'flex',
      flexFlow: 'row',
      alignItems: 'center',
      'label': {
        dispaly: 'block',
        flex: 'none',
        color: '#AAA',
        fontSize: 10,
        padding: 5
      },
      '&::after,&::before': {
        content: '""',
        dispaly: 'block',
        flex: 'auto',
        height: 1,
        color: '#333',
        background: '#DDD',
        borderBottom: '1px solid #FFF'
      }
    },
    '.record': {
      display: 'flex',
      flexFlow: 'row',
      fontSize: 12,
      lineHeight: 16,
      padding: 5,
      wordBreak: 'break-all',
      '.label': {
        flex: 'none',
        width: '30%',
        minWidth: 150,
        color: '#AAA',
        fontSize: 10,
        textAlign: 'right',
        paddingRight: 10,
        WebkitUserSelect: 'initial',
        '&::after': {
          content: '" : "'
        }
      },
      '.content': {
        flex: 'auto',
        WebkitUserSelect: 'initial',
        maxHeight: 100,
        overflow: 'auto'
      }
    }
  })
  render () {
    const { info, requestBodyMime, responseBodyMime, requestContentType, responseContentType, tab } = this.state
    if (!info) {
      return <div />
    }
    return (
      <div className="wrap">
        {this.props.independent ? (
          <div className="title">
            <TitleBar title="请求详情" />
          </div>
        ): null}
        <div className="detail">
          <div className="detail-wrap">
            <div className="tabs">
              <Tabs
                options={[{ label: '基本信息', value: 'basic' }, { label: '请求数据', value: 'request' }, { label: '响应数据', value: 'response' }]}
                value={tab}
                onChange={tab => this.setState({ tab })}
              />
              {this.props.independent ? null : (
                <a className="fa fa-external-link" onClick={this.onOpenWindow} />
              )}
            </div>
            {tab === 'basic' ? (
              <div>
                <div className="section">
                  <label>摘要</label>
                </div>
                <div className="record">
                  <div className="label">
                    进度
                  </div>
                  <div className="content">
                    {info.error ? '发生错误'
                    : info.isTruncated ? '请求过多，详情已丢弃'
                    : info.finishTime ? '求情完成'
                    : info.responseHeaders ? '正在下载'
                    : '正在发送'}
                  </div>
                </div>
                <div className="record">
                  <div className="label">
                    METHOD
                  </div>
                  <div className="content">
                    {info.method}
                  </div>
                </div>
                <div className="record">
                  <div className="label">
                    URL
                  </div>
                  <div className="content">
                    <span style={{ fontSize: 10 }}>{info.href}</span>
                  </div>
                </div>
                <div className="record">
                  <div className="label">
                    响应状态值
                  </div>
                  <div className="content">
                    {info.responseTime ? (
                      <span><strong>{info.statusCode}</strong> {info.statusMessage}</span>
                    ) : '-'}
                  </div>
                </div>
                {info.error ? (
                  <div className="record">
                    <div className="label">
                      报错信息
                    </div>
                    <div className="content">
                      {info.error}
                    </div>
                  </div>
                ) : null}
                {info.responseTime ? (
                  <div className="record">
                    <div className="label">
                      响应耗时
                    </div>
                    <div className="content">
                      {info.responseElapse}ms
                    </div>
                  </div>
                ) : null}
                {info.finishTime && info.responseTime ? (
                  <div className="record">
                    <div className="label">
                      下载耗时
                    </div>
                    <div className="content">
                      {info.finishElapse - info.responseElapse}ms
                    </div>
                  </div>
                ) : null}
                {info.finishTime ? (
                  <div className="record">
                    <div className="label">
                      请求总耗时
                    </div>
                    <div className="content">
                      {info.finishElapse}ms
                    </div>
                  </div>
                ) : null}
                <div className="record">
                  <div className="label">
                    数据传输
                  </div>
                  <div className="content">
                    上传 {info.responseTime || info.finishTime ? comaNumber(info.requestBodySize) : '-'} 字节
                    /
                    下载 {info.finishTime ? comaNumber(info.responseBodySize) : '-'} 字节
                  </div>
                </div>
        
                <div className="section">
                  <label>请求头</label>
                </div>
                {info.headers ? Object.keys(info.headers).map(key => (
                  <div className="record" key={key}>
                    <div className="label">
                      {key}
                    </div>
                    <div className="content">
                      {info.headers[key]}
                    </div>
                  </div>
                )) : null}
        
                <div className="section">
                  <label>响应头</label>
                </div>
                {info.responseHeaders ? Object.keys(info.responseHeaders).map(key => (
                  <div className="record" key={key}>
                    <div className="label">
                      {key}
                    </div>
                    <div className="content">
                      {info.responseHeaders[key]}
                    </div>
                  </div>
                )) : null}
              </div>
            ) : tab === 'request' ? (
              <div>
                <div className="section">
                  <label>地址参数</label>
                </div>
                {info.query ? (
                  <BodyDisplayer
                    href={`${serviceAddr}/get-record?requestID=${info.requestID}&field=query`}
                    mime="application/x-www-form-urlencoded"
                  />
                ): (
                  <div className="record">
                    <div className="label">
                      提示
                    </div>
                    <div className="content">
                      没有地址参数
                    </div>
                  </div>
                )}
                <div className="section">
                  <label>发出数据</label>
                </div>
                <div className="record">
                  <div className="label">
                    Content-Type
                  </div>
                  <div className="content">
                    {requestContentType || '-'}
                  </div>
                </div>
                <div className="record">
                  <div className="label">
                    推测类型
                  </div>
                  <div className="content">
                    {requestBodyMime || '-'}
                  </div>
                </div>
                {!info.responseTime ? (
                  <div className="record">
                    <div className="label">
                      内容
                    </div>
                    <div className="content">
                      正在加载
                    </div>
                  </div>
                ) :info.requestBodyIsTooLarge || info.isTruncated || info.requestBodySize === 0 ? (
                  <div className="record">
                    <div className="label">
                      内容
                    </div>
                    <div className="content">
                      {info.requestBodyIsTooLarge ? '尺寸超过限制，可在设置里提升上限。'
                      : info.isTruncated ? '请求过多，当前请求详情已被丢弃'
                      : info.requestBodySize === 0 ? '空'
                      : '-'}
                    </div>
                  </div>
                ) : (
                  <BodyDisplayer
                    href={`${serviceAddr}/get-record?requestID=${info.requestID}&field=requestBody`}
                    mime={requestBodyMime}
                  />
                )}
              </div>
            ) : tab === 'response' ? (
              <div>
                <div className="section">
                  <label>接收数据</label>
                </div>
                <div className="record">
                  <div className="label">
                    Content-Type
                  </div>
                  <div className="content">
                    {responseContentType || '-'}
                  </div>
                </div>
                <div className="record">
                  <div className="label">
                    推测类型
                  </div>
                  <div className="content">
                    {responseBodyMime || '-'}
                  </div>
                </div>
                {!info.finishTime ? (
                  <div className="record">
                    <div className="label">
                      内容
                    </div>
                    <div className="content">
                      正在加载
                    </div>
                  </div>
                ) :info.responseBodyIsTooLarge || info.isTruncated || info.responseBodySize === 0 ? (
                  <div className="record">
                    <div className="label">
                      内容
                    </div>
                    <div className="content">
                      {info.responseBodyIsTooLarge ? '尺寸超过限制，可在设置里提升上限'
                      : info.isTruncated ? '请求过多，当前请求详情已被丢弃'
                      : info.responseBodySize === 0 ? (
                        +info.statusCode === 304 ? '客户端缓存'
                        : /^3/.test(`${info.statusCode}`) ? '重定向'
                        : '空'
                      ) : '-'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="record">
                      <div className="label">
                        内容
                      </div>
                      <div className="content">
                        <a onClick={this.onSave}>另存为</a>
                      </div>
                    </div>
                    <BodyDisplayer
                      href={`${serviceAddr}/get-record?requestID=${info.requestID}&field=responseBody`}
                      mime={responseBodyMime}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }
}

function comaNumber (num) {
  num = `${num | 0}`.split('')
  let ret = []
  num.reverse().forEach((digit, index) => {
    if (index > 0 && index % 3 === 0) {
      ret.push(',')
    }
    ret.push(digit)
  })
  return ret.reverse().join('')
}

export default RecordDetail
