import classnames from 'classnames'
import TitleBar from '../components/title-bar'
import { Checkbox } from '../components/form'
import { Colors } from '../colors';
import { open as openConfig } from './config'
import Record from './record'
import { openFile as openDetail } from './record-detail'
import Rules from './Rules'
import { prompt } from './prompt'
import opn from 'opn'

@requireWindow
@autobind
class Main extends Component {
  componentWillMount () {
    this.setState({
      curTab: 0,
      tabs: [
        '抓包记录',
        '转发规则'
      ],
      connected: eventBus.connnected,
      useLocalProxy: false
    })
    this.context.nativeWindow.setMinimumSize(700, 350)
    eventBus.on('connection', this.onConnectedChange)
    eventBus.on('service:store', this.onConnectedChange)
    this.pollInterval = setInterval(this.onConnectedChange, 5000)
  }

  componentWillUnmount () {
    eventBus.removeListener('connection', this.onConnectedChange)
    eventBus.removeListener('service:store', this.onConnectedChange)
    clearInterval(this.pollInterval)
  }

  onConnectedChange () {
    const store = eventBus.store
    this.setState({
      connected: eventBus.connected,
      hasServiceProcess: eventBus.hasServiceProcess,
      useLocalProxy: eventBus.useLocalProxy,
      addr: store && store.addr,
      port: store && store.config.port
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

  onOpenGithub () {
    opn('https://github.com/davidaq/vodo', { wait: false })
  }

  onUseLocalProxy (val) {
    eventBus.emit('use-local-proxy', val)
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
      fontSize: 12,
      '.fa': {
        padding: '3px 5px',
        cursor: 'pointer',
        transition: 'background 0.3s',
        fontSize: 14,
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
      },
      '.footer': {
        flex: 'none',
        height: 22,
        lineHeight: 22,
        borderTop: '1px solid #CCC',
        background: '#FAFAFA',
        padding: '0 5px',
        fontSize: 12,
        color: '#555',
        '.left': {
          float: 'left',
          transform: 'scale(0.9) translateX(-5%)'
        },
        '.right': {
          float: 'right',
          transform: 'scale(0.9) translateX(5%)'
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
                  <span className="tip" onClick={this.onChangeAddr}>代理已启动 - {this.state.addr} : {this.state.port}</span>
                ) : this.state.hasServiceProcess ? (
                  <span className="tip" onClick={this.onChangeAddr}>正在启动代理服务器</span>
                ) : (
                  <span className="tip" onClick={this.onChangeAddr}>代理未启动，点击这里改变端口</span>
                )}
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <a className="fa fa-github" onClick={this.onOpenGithub} title="了解本项目"></a>
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
        <div className="footer">
          <div className="left">
            <Checkbox value={this.state.useLocalProxy} onChange={this.onUseLocalProxy}>
              监听我的{isOsX ? 'Mac' : '电脑'}
            </Checkbox>
          </div>
          <div className="right">
            v{APP_VERSION}
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
    let isQuiting = false
    win.on('close', () => {
      if (eventBus.useLocalProxy && !confirm('在开启监听到情况下关闭vodo会导致网络不可用，是否继续？')) {
        return false
      }
      if (!isQuiting) {
        isQuiting = true
        eventBus.emit('quit')
        nw.App.closeAllWindows()
        win.close(true)
        nw.App.quit()
        setTimeout(() => {
          process.exit(0)
        }, 2000)
      }
    })
  }, openDetail)
}

