import classnames from 'classnames'

@autobind
class DataViewer extends Component {
  componentWillMount () {
    const { data, depth = 0 } = this.props
    const isObj = data && typeof data === 'object'
    const isArray = isObj && Array.isArray(data)
    const keys = isObj && Object.keys(data)
    const expanded = depth < 2
    const rawVal = !isObj && JSON.stringify(data)
    this.setState({ keys, isObj, isArray, expanded, rawVal })
  }

  onToggleExpand () {
    this.setState({ expanded: !this.state.expanded })
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
        width: 80,
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
    const { data, depth, name } = this.props
    const { keys, isObj, isArray, expanded, rawVal } = this.state
    const nextDepth = depth + 1
    const isEmpty = isObj && keys.length === 0
    return (
      <div className="data">
        {name ? (
          <div className="name" onClick={this.onToggleExpand} title={name}>
            {name}
          </div>
        ) : null}
        {name ? (
          <div className="vary">:</div>
        ) : null}
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
                  key={key}
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

