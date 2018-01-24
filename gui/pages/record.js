import classnames from 'classnames'
import TreeRecord from '../components/tree-record'
import ListRecord from '../components/list-record'
import { Tabs } from '../components/form'
import RecordDetail from './record-detail'

let recordList
let recordMap
let recordTree

function resetRecord () {
  recordList = []
  recordMap = {}
  recordTree = {
    name: '#ROOT',
    leaf: [],
    subList: [],
    subMap: {},
    totalLeafCount: 0,
    leafId: {},
    expanded: true,
    depth: 0,
    updateTime: 0
  }
}
resetRecord()

eventBus.on('service:begin', ([data]) => {
  data.status = 'requesting'
  recordList.push(data)
  recordMap[data.requestID] = data
  const path = data.pathname.split(/\/+/)
  path[0] = `${data.protocol}//${data.hostname}:${data.port}`
  const leaf = path.pop() || '/'
  let curNode = recordTree
  path.forEach(part => {
    curNode.totalLeafCount++
    curNode.leafId[data.requestID] = true
    curNode.updateTime = Date.now()
    let nextNode = curNode.subMap[part]
    if (!nextNode) {
      nextNode = {
        name: part,
        leaf: [],
        subList: [],
        subMap: {},
        totalLeafCount: 0,
        leafId: {},
        expanded: false,
        depth: curNode.depth + 1,
        updateTime: Date.now()
      }
      curNode.subList.push(part)
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
  curNode.leaf.sort((a, b) => {
    if (a.name === b.name) {
      return a.record.startTime - b.record.startTime
    } else {
      return a.name.localeCompare(b.name)
    }
  })
  eventBus.emit('record', data.requestID)
})

eventBus.on('service:respond', ([requestID]) => {
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'receiving'
    eventBus.emit('record', requestID)
  }
})

eventBus.on('service:finish', ([requestID]) => {
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'finish'
    eventBus.emit('record', requestID)
  }
})

eventBus.on('service:error', ([requestID]) => {
  const oData = recordMap[requestID]
  if (oData) {
    oData.status = 'error'
    eventBus.emit('record', requestID)
  }
})

let prevSelected = ''

@autobind
@requireWindow
class Record extends Component {
  
  componentWillMount () {
    this.setState({
      entriesMode: 'tree',
      selected: prevSelected,
      sideWidth: 300,
      refreshKey: Date.now()
    })
    eventBus.on('record', this.onRecordUpdate)
    this.context.window.addEventListener('resize', this.onWindowResize)
  }

  componentWillUnmount () {
    prevSelected = this.state.selected
    eventBus.removeListener('record', this.onRecordUpdate)
    this.context.window.removeEventListener('resize', this.onWindowResize)
  }

  onRecordUpdate () {
    if (!this.updateTimeout) {
      this.updateTimeout = setTimeout(() => {
        this.updateTimeout = null
        this.setState({ refreshKey: Date.now() })
      }, 100)
    }
  }

  onSelect (record) {
    this.setState({ selected: record.requestID })
  }

  onWindowResize () {
    const sideWidthLimit = Math.floor(this.context.window.innerWidth / 2)
    if (this.state.sideWidth > sideWidthLimit) {
      this.setState({ sideWidth: sideWidthLimit })
    }
  }

  onClear () {
    resetRecord()
    this.forceUpdate()
  }

  onResizeStart (ev) {
    ev.preventDefault()
    ev.stopPropagation()
    const startX = ev.pageX
    const startWidth = this.state.sideWidth
    const window = this.context.window
    const document = window.document
    const onResizeMove = (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      const dx = ev.pageX - startX
      const sideWidthLimit = Math.floor(this.context.window.innerWidth / 2)
      let sideWidth = startWidth + dx
      if (sideWidth < 250) {
        sideWidth = 250
      } else if (sideWidth > sideWidthLimit) {
        sideWidth = sideWidthLimit
      }
      this.setState({ sideWidth })
    }
    const onResizeStop = (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      document.removeEventListener('mousemove', onResizeMove)
      document.removeEventListener('mouseup', onResizeStop)
    }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeStop)
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
        flex: 'none',
        boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        padding: '5px 0',
        background: '#F7F7F7',
        position: 'relative',
        '.clear-btn': {
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
        },
      },
      '.records': {
        flex: 'auto',
        position: 'relative',
        '&-pad': {
          height: 50
        },
        '&-wrap': {
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '100%',
          overflow: 'auto',
          whiteSpace: 'nowrap'
        }
      }
    },
    '.main': {
      position: 'relative',
      flex: 'auto',
      height: '100%',
      '&-wrap': {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '100%'
      },
      '.resizer': {
        position: 'absolute',
        zIndex: '1',
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
    let { entriesMode, selected, sideWidth, refreshKey } = this.state
    const selectedRecord = recordMap[selected]
    if (!selectedRecord) {
      selected = ''
    }
    return (
      <div className="wrap">
        <div className="side" style={{ width: sideWidth }}>
          <div className="mode-switch">
            <Tabs
              options={[{ label: '结构树', value: 'tree' }, { label: '时序列表', value: 'list' }]}
              value={this.state.entriesMode}
              onChange={entriesMode => this.setState({ entriesMode })}
            />
            <a className="clear-btn fa fa-trash-o" onClick={this.onClear} />
          </div>
          <div className="records">
            <div className="records-wrap scrollable">
              {entriesMode === 'tree' ? (
                <TreeRecord data={recordTree} onSelect={this.onSelect} selected={selected} refreshKey={refreshKey} />
              ) : (
                <ListRecord data={recordList} onSelect={this.onSelect} selected={selected} refreshKey={refreshKey} />
              )}
              <div className="records-pad" />
            </div>
          </div>
        </div>
        <div className="main">
          <div className="resizer" onMouseDown={this.onResizeStart}></div>
          <div className="main-wrap">
            {selectedRecord ? (
              <RecordDetail
                key={selectedRecord.requestID}
                requestID={selectedRecord.requestID}
              />
             ): null}
          </div>
        </div>
      </div>
    )
  }
}

export default Record

