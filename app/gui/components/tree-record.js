import ScrollToMe from './scroll-to-me'
import classnames from 'classnames'

@autobind
class TreeRecord extends Component {
  
  componentWillMount () {
    const { data, selected } = this.props
    const hasSelect = !!data.leafId[selected]
    if (hasSelect && !data.expanded) {
      data.expanded = true
    }
  }

  onToggleExpand () {
    const { data } = this.props
    if (data.expanded) {
      data.expanded = false
    } else {
      const walk = (node) => {
        node.expanded = true
        if (node.subList.length === 1 && node.leaf.length === 0) {
          walk(node.subMap[node.subList[0]])
        }
      }
      walk(data)
    }
    this.forceUpdate()
  }

  @CSS({
    '.node': {
      fontSize: 12,
      lineHeight: 25
    },
    '.fa': {
      width: 16,
      textAlign: 'center'
    },
    '.name, .leaf': {
      cursor: 'pointer'
    },
    '.name.select': {
      background: '#F7F7F7'
    },
    '.leaf.select': {
      background: '#DDD'
    },
    '.method': {
      display: 'inline-block',
      color: '#AAA',
      transform: 'scale(0.6)',
    },
    '.hot .hotbg': {
      '@keyframes hot': {
        '0%': {
          background: 'rgba(0, 0, 0, 0)'
        },
        '20%': {
          background: 'rgba(0, 0, 0, 0.2)'
        },
        '100%': {
          background: 'rgba(0, 0, 0, 0)'
        }
      },
      animation: 'hot 1s ease-out'
    }
  })
  render () {
    const { data, onSelect, selected } = this.props
    const hasSelect = !!data.leafId[selected]
    const padding = (data.depth - 1) * 20 + 5
    return (
      <div className="tree-record">
        {data.name === '#ROOT' ? (
          data.subList.map(subName => (
            <TreeRecord
              key={subName}
              data={data.subMap[subName]}
              onSelect={onSelect}
              selected={selected}
            />
          ))
        ) : (
          <div className="node">
            <div
              className={classnames('name', {
                select: hasSelect,
                hot: Date.now() - data.updateTime < 1000
              })}
              style={{ paddingLeft: padding }}
              onClick={this.onToggleExpand}
            >
              <div className="hotbg">
                <i className={classnames('fa', data.expanded ? 'fa-folder-open' : 'fa-folder')} />
                {data.name}
              </div>
            </div>
            {data.expanded ? (
              <div className="children">
                <div className="sub">
                  {data.subList.map(subName => (
                    <TreeRecord key={subName} data={data.subMap[subName]} onSelect={onSelect} selected={selected} />
                  ))}
                </div>
                <div className="leaf">
                  {data.leaf.map(leaf => (
                    <div
                      key={leaf.record.requestID}
                      className={classnames('leaf', {
                        select: hasSelect && selected === leaf.record.requestID,
                        hot: Date.now() - leaf.record.startTime < 1000
                      })}
                      onClick={() => onSelect(leaf.record)}
                      style={{ paddingLeft: padding + 20 }}
                    >
                      <div className="hotbg">
                        <i className={classnames('fa', {
                          'fa-upload': leaf.record.status === 'requesting',
                          'fa-download': leaf.record.status === 'receiving',
                          'fa-check': leaf.record.status === 'finish',
                          'fa-close': leaf.record.status === 'error',
                        })} />
                        {hasSelect && selected === leaf.record.requestID ? (
                          <ScrollToMe />
                        ): null}
                        {leaf.name}
                        <span className="method">
                          {leaf.record.method.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }
}

export default TreeRecord

