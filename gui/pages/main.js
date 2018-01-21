import classnames from 'classnames'
import TitleBar from '../components/title-bar'
import { Colors } from '../colors';
import { open as openConfig } from './config'

@requireWindow
@autobind
class Main extends React.Component {
  componentWillMount () {
    this.setState({
      curTab: 0,
      tabs: [
        '抓包记录',
        '转发规则'
      ]
    })
    this.context.nativeWindow.setMinimumSize(500, 350)
  }

  onSwitchTab (index) {
    this.setState({ curTab: index })
  }

  onOpenConfig () {
    openConfig()
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
    '.config': {
      WebkitAppRegion: 'no-drag',
      cursor: 'pointer',
      position: 'absolute',
      top: isWindows ? 30 : 5,
      right: 5,
      fontSize: 10,
      transition: 'background 0.3s',
      padding: '3px 5px',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.15)',
      }
    },
    '.bottom': {
      height: 5,
      background: Colors.primary,
      boxShadow: '0 -3px 3px rgba(0, 0, 0, 0.5)'
    }
  })
  render () {
    return (
      <div>
        <TitleBar>
          <div className="nav-pannel">
            <div className="logo"></div>
            <div className="tabs">
              {this.state.tabs.map((name, index) => (
                <a className={classnames({ tab: true, active: this.state.curTab === index })} onClick={() => this.onSwitchTab(index)}>
                  {name}
                </a>
              ))}
            </div>
            <a className="config fa fa-cog" onClick={this.onOpenConfig}></a>
            <div className="bottom"></div>
          </div>
        </TitleBar>
        hello world
      </div>
    )
  }
}

export default Main

export const open = () => {
  const options = {
    width: 600,
    height: 450,
  }
  openUI('main', options, (win) => {
    win.on('close', () => {
      win.close(true)
      nw.App.quit()
    })
  })
}
