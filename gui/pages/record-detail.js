import { Tabs } from './components/form'
import BodyDisplayer from './components/body-displayer'
import TitleBar from '../components/title-bar'

@autobind
class RecordDetail extends Component {
  
  componentWillMount () {
    const { requestID } = this.props
    this.setState({ tab: 'basic' })
    this.updateState(requestID)
    eventBus.on('record', this.updateState)
  }

  componentWillUnmount () {
    eventBus.removeListener('record', this.updateState)
  }

  updateState (requestID) {
    if (requestID === this.props.requestID) {
      Promise.all([
        fetch(`${serviceAddr}/get-record?requestID=${requestID}`)
        .then(r => r.json()).catch(err => null),
        fetch(`${serviceAddr}/get-record?requestID=${requestID}&field=requestBody&examine=1`)
        .then(r => r.text()).catch(err => null),
        fetch(`${serviceAddr}/get-record?requestID=${requestID}&field=responseBody&examine=1`)
        .then(r => r.text()).catch(err => null)
      ])
      .then(([info, requestBodyMime, responseBodyMime]) => {
        this.setState({ info, requestBodyMime, responseBodyMime })
        if (!this.state.requestContentType) {
          Object.keys(info.headers).forEach(key => {
            if (key.toLowerCase() === 'content-type') {
              this.setState({ requestContentType: info.headers[key].split(';')[0] })
            }
          })
        }
        if (!this.state.responseContentType && info.responseHeaders) {
          Object.keys(info.responseHeaders).forEach(key => {
            if (key.toLowerCase() === 'content-type') {
              this.setState({ responseContentType: info.responseHeaders[key].split(';')[0] })
            }
          })
        }
      })
    }
  }

  onOpenWindow () {
    openUI('record-detail', {
      props: { requestID: this.props.requestID, independent: true },
      width: 500,
      height: 400
    }, win => {
      win.setMinimumSize(400, 300)
    })
  }

  @CSS({
    '.detail': {
      padding: 5
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
      <div>
        {this.props.independent ? <TitleBar /> : null}
        <div className="detail">
          <div className="tabs">
            <Tabs
              options={[{ label: '基本信息', value: 'basic' }, { label: '请求数据', value: 'request' }, { label: '响应数据', value: 'response' }]}
              value={tab}
              onChange={tab => this.setState({ tab })}
            />
            <a className="fa fa-window-restore" onClick={this.onOpenWindow} />
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
                  {info.error
                  ? '发生错误'
                  : info.finishTime
                  ? '求情完成'
                  : info.responseHeaders
                  ? '正在下载'
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
                <div className="record">
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
                <div className="record">
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
              <div className="section">
                <label>发出数据</label>
              </div>
              <BodyDisplayer
                href={`${serviceAddr}/get-record?requestID=${info.requestID}`}
                isTooLarge={info.requestBodyIsTooLarge} 
                size={info.requestBodySize}
                contentType={requestContentType}
                mime={requestBodyMime}
              />
            </div>
          ) : tab === 'response' ? (
            <div>
              <div className="section">
                <label>接收数据</label>
              </div>
              <BodyDisplayer
                href={`${serviceAddr}/get-record?requestID=${info.requestID}`}
                isTooLarge={info.requestBodyIsTooLarge} 
                size={info.requestBodySize}
                contentType={responseContentType}
                mime={requestBodyMime}
              />
            </div>
          ) : null}
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
