import classnames from 'classnames'
import TitleBar from '../components/title-bar'
import { Colors } from '../colors';
import { open as openConfig } from './config'
import Record from './record'
import { openFile as openDetail } from './record-detail'
import Rules from './Rules'
import { prompt } from './prompt'

@requireWindow
@autobind
class Main extends React.Component {
  componentWillMount () {
    this.setState({
      curTab: 0,
      tabs: [
        '抓包记录',
        '转发规则'
      ],
      connected: eventBus.connnected
    })
    this.context.nativeWindow.setMinimumSize(700, 350)
    eventBus.on('connection', this.onConnectedChange)
    eventBus.on('service:store', this.onConnectedChange)
  }

  componentWillUnmount () {
    eventBus.removeListener('connection', this.onConnectedChange)
    eventBus.removeListener('service:store', this.onConnectedChange)
  }

  onConnectedChange () {
    this.setState({
      connected: eventBus.connected
    })
  }

  onSwitchTab (index) {
    this.setState({ curTab: index })
  }

  onOpenConfig () {
    openConfig()
  }

  onOpenDetail () {
    this.context.window.chooseFile(openDetail)
  }

  onChangeAddr () {
    const port = serviceAddr.split(':').pop()
    prompt({ title: '修改代理地址', defaultValue: port }, { width: 150 })
    .then(val => {
      eventBus.emit('change-service', val)
    })
  }

  @CSS({
    '.nav-pannel': {
      position: 'relative',
      paddingTop: isWindows ? 0 : 15
    },
    '.logo': {
      display: 'inline-block',
      verticalAlign: 'middle',
      background: 'url(images/logo-white.png) no-repeat center center',
      width: 80,
      height: 50,
      marginRight: 30
    },
    '.tabs': {
      display: 'inline-block',
      '.tab': {
        WebkitAppRegion: 'no-drag',
        display: 'inline-block',
        position: 'relative',
        verticalAlign: 'middle',
        textAlign: 'center',
        height: 50,
        lineHeight: 50,
        width: 90,
        fontSize: 13,
        color: Colors.headFont,
        borderTop: '1px solid rgba(0, 0, 0, 0)',
        transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s, color 0.3s',
        cursor: 'pointer',
        '&:hover, &.active': {
          background: Colors.headTabHighlightBG,
          color: '#FFF',
          borderTop: '1px solid #222',
          boxShadow: 'inset 0 0 10px #000'
        },
        '&.active::after': {
          content: '""',
          display: 'block',
          position: 'absolute',
          bottom: 0,
          left: 40,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: `5px solid ${Colors.primary}`,
          boxShadow: 'inset 0 -3px 3px rgba(0, 0, 0, 0.2)'
        }
      }
    },
    '.extra': {
      WebkitAppRegion: 'no-drag',
      position: 'absolute',
      top: isWindows ? 30 : 5,
      right: 5,
      fontSize: 10,
      '.fa': {
        padding: '3px 5px',
        cursor: 'pointer',
        transition: 'background 0.3s',
        '&:hover': {
          background: 'rgba(255, 255, 255, 0.15)',
        }
      },
      '.tip': {
        color: '#888',
        cursor: 'pointer',
        '&:hover': {
          color: '#CCC',
          textDecoration: 'underline'
        }
      }
    },
    '.bottom': {
      height: 5,
      background: Colors.primary,
      boxShadow: '0 -3px 3px rgba(0, 0, 0, 0.5)'
    },
    '.wrap': {
      display: 'flex',
      flexFlow: 'column',
      height: '100%',
      '.title': {
        flex: 'none'
      },
      '.main': {
        flex: 'auto',
        position: 'relative',
        '&-wrap': {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }
      }
    }
  })
  render () {
    return (
      <div className="wrap">
        <div className="title">
          <TitleBar>
            <div className="nav-pannel">
              <div className="logo"></div>
              <div className="tabs">
                {this.state.tabs.map((name, index) => (
                  <a key={index} className={classnames({ tab: true, active: this.state.curTab === index })} onClick={() => this.onSwitchTab(index)}>
                    {name}
                  </a>
                ))}
              </div>
              <div className="extra">
                {this.state.connected ? (
                  <span className="tip" onClick={this.onChangeAddr}>代理已启动 - {eventBus.store.addr} : {eventBus.store.config.port}</span>
                ) : eventBus.hasServiceProcess ? (
                  <span className="tip" onClick={this.onChangeAddr}>正在启动代理服务器</span>
                ) : (
                  <span className="tip" onClick={this.onChangeAddr}>代理未启动，点击这里改变端口</span>
                )}
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <a className="fa fa-folder-open-o" onClick={this.onOpenDetail} title="打开请求记录"></a>
                <a className="fa fa-cog" onClick={this.onOpenConfig} title="设置"></a>
              </div>
              <div className="bottom"></div>
            </div>
          </TitleBar>
        </div>
        <div className="main">
          <div className="main-wrap">
            {this.state.curTab === 0 ? (
              <Record />
            ) : (
              <Rules />
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default Main

export const open = () => {
  const options = {
    width: 800,
    height: 550,
  }
  openUI('main', options, (win) => {
    win.on('close', () => {
      eventBus.emit('quit')
      win.close(true)
      nw.App.quit()
    })
  }, openDetail)
}

