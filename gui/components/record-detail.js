
class RecordDetail extends Component {
  
  componentWillMount () {
    const { requestID } = this.props
    this.setState({})
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
    })
  }

  @CSS({
    '.detail': {
      padding: 5,
    },
    '.section': {
      display: 'flex',
      flexFlow: 'row',
      '.label': {
        dispaly: 'block',
        flex: 'none'
      },
      '&::after': {
        content: '""',
        dispaly: 'block',
        flex: 'auto',
        height: 1,
        background: '#DDD'
      }
    },
    '.record': {
      display: 'flex',
      flexFlow: 'row',
      fontSize: 12,
      lineHeight: 16,
      padding: 5,
      '.label': {
        flex: 'none',
        width: 90,
        color: '#AAA',
        fontSize: 10,
        textAlign: 'right',
        paddingRight: 10,
        '&::after': {
          content: '" : "',
        }
      },
      '.content': {
        flex: 'auto',
        wordBreak: 'break-all',
        WebkitUserSelect: 'initial',
        cursor: 'text'
      }
    }
  })
  render () {
    const { info, requestBodyMime, responseBodyMime } = this.state
    if (!info) {
      return <div />
    }
    return (
      <div className="detail">
        <div className="section">
          <label>摘要</label>
        </div>
        <div className="record">
          <div className="label">
            状态
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
            {info.href}
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
       {info.responseTime ? (
          <div className="record">
            <div className="label">
              数据上传大小
            </div>
            <div className="content" title={`${info.requestBodySize}B`}>
              {info.requestBodySize}B
            </div>
          </div>
        ) : null}
       {info.finishTime ? (
          <div className="record">
            <div className="label">
              数据下载大小
            </div>
            <div className="content" title={`${info.responseBodySize}B`}>
              {info.responseBodySize}B
            </div>
          </div>
        ) : null}
        
        {requestBodyMime}
        {responseBodyMime}
        {JSON.stringify(info, false, '  ')}
      </div>
    )
  }
}

export default RecordDetail

