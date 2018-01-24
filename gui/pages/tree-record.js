import classnames from 'classnames'
import { EventEmitter } from 'events'

const recordList = []
const recordTree = {
  name: '',
  leaf: [],
  subList: [],
  subMap: {},
  totalLeafCount: 0,
  leafId: {},
  expanded: true
}
const recordMap = {}
const recordEv = new EventEmitter()

eventBus.on('begin' (event) => {
  const [ data ] = JSON.parse(event.data)
  data.status = 'requesting'
  recordList.push(data)
  recordMap[data.requestID] = data
  const path = [
    `${data.protocol}//${data.hostname}:${data.port}`,
    ...data.pathname.split(/\/+/)
  ]
  const leaf = path.pop()
  let curNode = recordTree
  path.forEach(part => {
    curNode.totalLeafCount++
    curNode.leafId[data.requestID] = true
    let nextNode = curNode.subMap[part]
    if (!nextNode) {
      nextNode = {
        name: part,
        leaf: [],
        subList: [],
        subMap: {},
        totalLeafCount: 0,
        leafId: {},
        expanded: false
      }
      curNode.subMap[part] = nextNode
    }
    curNode = nextNode
  })
  curNode.totalLeafCount++
  curNode.leafId[data.requestID] = true
  curNode.leaf.push({
    name: leaf,
    record: data
  })
  recordEv.emit('record')
})

serviceEv.addEventListener('respond' (event) => {
  const [ requestID ] = JSON.parse(event.data)
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'receiving'
  }
  recordEv.emit('record')
})

serviceEv.addEventListener('finish' (event) => {
  const [ requestID ] = JSON.parse(event.data)
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'receiving'
  }
  recordEv.emit('record')
})

serviceEv.addEventListener('error' (event) => {
  const [ requestID ] = JSON.parse(event.data)
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'error'
  }
  recordEv.emit('record')
})

@autobind
class Record extends Component {
  
  componentWillMount () {
    this.setState({
      entriesMode: 'tree'
    })
    recordEv.on('record', this.onRecordUpdate)
  }

  componentWillUnmount () {
    recordEv.removeListener('record', this.onRecordUpdate)
  }

  onRecordUpdate () {
    this.forceUpdate()
  }

  onSelect (record) {
  }

  @CSS({
    '.wrap': {
      display: 'flex',
      flexFlow: 'row',
      height: '100%'
    },
    '.side': {
      display: 'flex',
      flexFlow: 'column',
      flex: 'none',
      height: '100%',
      width: 300,
      background: '#FFF',
      overflow: 'hidden',
      '.mode-switch': {
        boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        padding: '5px 0',
        background: '#F7F7F7'
      },
      '.mode-wrap': {
        display: 'inline-block',
        border: '1px solid #CCC',
        borderRadius: 5,
        overflow: 'hidden'
      },
      '.mode': {
        display: 'inline-block',
        padding: 5,
        width: 70,
        fontSize: 10,
        lineHeight: 16,
        color: '#AAA',
        borderLeft: '1px solid #CCC',
        transition: 'background 0.3s, box-shadow 0.3s',
        background: '#EEE',
        '&.first': {
          borderLeft: 'none'
        },
        '&:hover': {
          boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.3)'
        },
        '&.active': {
          color: '#333',
          fontSize: 13,
          background: '#FFF'
        }
      }
    },
    '.main': {
      position: 'relative',
      flex: 'auto',
      height: '100%',
      '.resizer': {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: 5,
        borderLeft: '1px solid #BBB',
        cursor: 'ew-resize',
        transition: 'background 0.3s',
        '&:hover': {
          background: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
  })
  render () {
    const { entriesMode } = this.state
    return (
      <div className="wrap">
        <div className="side">
          <div className="mode-switch">
            <div className="mode-wrap">
              <div className={classnames('mode', 'first', { active: entriesMode === 'tree' })} onClick={() => this.setState({ entriesMode: 'tree' })}>
                地址结构
              </div>
              <div className={classnames('mode', { active: entriesMode === 'list' })} onClick={() => this.setState({ entriesMode: 'list' })}>
                时序列表
              </div>
            </div>
          </div>
          {entriesMode === 'tree' ? (
            <TreeRecord data={recordTree} />
          ) : (
            <ListRecord data={recordMap} />
          )}
        </div>
        <div className="main">
          <div className="resizer"></div>
        </div>
      </div>
    )
  }
}

export default Record

