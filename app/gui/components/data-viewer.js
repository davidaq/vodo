@requireWindow
@autobind
class DataViewer extends Component {
  componentWillMount () {
    const { data, depth = 0, keyWidthMap ={} } = this.props
    const isObj = data && typeof data === 'object'
    const isArray = isObj && Array.isArray(data)
    const keys = isObj && Object.keys(data)
    const expanded = depth <= 2
    const rawVal = !isObj && JSON.stringify(data)
    this.setState({ keys, isObj, isArray, expanded, rawVal, keyWidthMap })
  }

  componentDidMount () {
    const { data, name, depth = 0, path = '' } = this.props
    const nameEl = this.base.querySelector('.name')
    if (nameEl) {
      nameEl.addEventListener('contextmenu', ev => {
        ev.preventDefault()
        ev.stopPropagation()
        const menu = this.context.window.createMenu()
        if (depth > 0) {
          menu.append(new nw.MenuItem({
            label: '复制属性路径',
            click: () => {
              nw.Clipboard.get().set(path, 'text')
            }
          }))
          menu.append(new nw.MenuItem({
            label: '复制属性键',
            click: () => {
              nw.Clipboard.get().set(name, 'text')
            }
          }))
        }
        menu.append(new nw.MenuItem({
          label: '复制属性值',
          click: () => {
            nw.Clipboard.get().set(JSON.stringify(data, false, '  '), 'text')
          }
        }))
        let { mouseX, mouseY } = this.context.window
        menu.popup(mouseX, mouseY)
      })
    }
  }

  onToggleExpand () {
    this.setState({ expanded: !this.state.expanded })
  }

  calcKeyWidth (el) {
    const { depth, resolveKeyWidth } = this.props
    setTimeout(() => {
      if (resolveKeyWidth) {
        resolveKeyWidth(depth, el.offsetWidth)
      } else {
        this.resolveKeyWidth(depth, el.offsetWidth)
      }
    }, 30)
  }

  resolveKeyWidth (depth, width) {
    const curWidth = this.state.keyWidthMap[depth] || 0
    if (width > 300) {
      width = 300
    }
    if (width > curWidth) {
      this.setState({
        keyWidthMap: {
          ...this.state.keyWidthMap,
          [depth]: width
        }
      })
    }
  }

  @CSS({
    '.data': {
      WebkitUserSelect: 'initial',
      fontSize: 12,
      lineHeight: 18,
      '&:hover > .name': {
        background: 'rgba(0, 0, 0, 0.1)'
      },
      '.name': {
        display: 'inline-block',
        cursor: 'pointer',
        color: '#555',
        verticalAlign: 'top',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: 'background 0.3s'
      },
      '.vary': {
        display: 'inline-block',
        verticalAlign: 'top',
        padding: '0 5px'
      },
      '.value': {
        display: 'inline-block',
        verticalAlign: 'top',
        whiteSpace: 'nowrap',
        '&.expanded': {
          display: 'block',
          paddingLeft: 20,
          borderLeft: '3px solid rgba(0, 0, 0, 0)',
          transition: 'border-color 0.3s',
          '&:hover': {
            borderLeft: '3px solid rgba(0, 0, 0, 0.1)'
          }
        }
      }
    }
  })
  render () {
    let { data, depth = 0, name, path = '' } = this.props
    const { keys, isObj, isArray, expanded, rawVal } = this.state
    const resolveKeyWidth = depth > 0
      ? this.props.resolveKeyWidth
      : this.resolveKeyWidth
    const keyWidthMap = depth > 0
      ? this.props.keyWidthMap
      : this.state.keyWidthMap

    const nextDepth = depth + 1
    const isEmpty = isObj && keys.length === 0
    return (
      <div className="data">
        {depth > 0 ? (
          <div ref={this.calcKeyWidth} className="name" onClick={this.onToggleExpand} title={path} style={{ minWidth: keyWidthMap[depth] || 0 }}>
            {name}
          </div>
        ) : (
          <div className="name root">
            数据结构
          </div>
        )}
        <div className="vary">:</div>
        {isObj ? (
          <div className="vary" onClick={this.onToggleExpand}>
            {isArray ? '[' : '{'}
          </div>
        ) : null}
        {isObj && !isEmpty ? (
          expanded ? (
            <div className="value expanded">
              {keys.map(key => (
                <DataViewer
                  keyWidthMap={keyWidthMap}
                  resolveKeyWidth={resolveKeyWidth}
                  key={key}
                  path={isArray ? `${path}[${key}]` : path ? `${path}.${key}` : key}
                  name={key}
                  data={data[key]}
                  depth={nextDepth}
                />
              ))}
            </div>
          ) : (
            <div className="vary" onClick={this.onToggleExpand}>
              ...
            </div>
          )
        ) : null}
        {isObj ? (
          <div className="vary" onClick={this.onToggleExpand}>
            {isArray ? ']' : '}'}
          </div>
        ) : null}
        {!isObj ? (
          <div className="value raw">
            {rawVal}
          </div>
        ) : null}
      </div>
    )
  }
}

export default DataViewer

