@requireWindow
@autobind
class TitleBar extends Component {

  componentWillMount () {
    this.setState({
      maximized: false,
      minimized: false
    })
    this.context.nativeWindow.on('minimize', this.onMinimized)
    this.context.nativeWindow.on('maximize', this.onMaximized)
    this.context.nativeWindow.on('restore', this.onRestored)
  }

  componentWillUnmount () {
    this.context.nativeWindow.removeListener('minimize', this.onMinimized)
    this.context.nativeWindow.removeListener('maximize', this.onMaximized)
    this.context.nativeWindow.removeListener('restore', this.onRestored)
  }

  componentDidMount () {
    this.calc()
  }

  componentDidUpdate () {
    this.calc()
  }

  calc () {
    if (this.props.title) {
      this.context.nativeWindow.title = `${this.props.title} - Vodo`
    }
  }

  onMinimized () {
    this.setState({ minimized: true })
  }

  onMaximized () {
    this.setState({ maximized: true })
  }

  onRestored () {
    if (this.state.minimized) {
      this.setState({ minimized: false })
    } else {
      this.setState({ maximized: false })
    }
  }

  onClose () {
    this.context.nativeWindow.close()
  }

  onMinimize () {
    this.context.nativeWindow.minimize()
  }

  onMaximize () {
    if (this.state.maximized) {
      this.context.nativeWindow.restore()
    } else {
      this.context.nativeWindow.maximize()
    }
  }

  @CSS({
    '.title': {
      backgroundColor: Colors.headBG,
      minHeight: 35,
      color: Colors.headFont,
      WebkitAppRegion: 'drag',
      '.control-buttons': isWindows
      ? {
        position: 'absolute',
        zIndex: '1',
        top: -5,
        right: -5,
        border: '1px solid #2D2D2D',
        boxShadow: 'inset 0 0 5px #000',
        borderRadius: 5,
        padding: '7px 7px 0 3px',
        a: {
          display: 'inline-block',
          WebkitAppRegion: 'no-drag',
          width: 25,
          height: 20,
          borderRadius: 3,
          transition: 'background 0.2s',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.1)'
          },
          '&::after': {
            content: '""',
            display: 'block',
            width: '100%',
            height: '100%',
          },
          '&.close::after': {
            background: `url(images/close.png) no-repeat center center`,
          },
          '&.minimize::after': {
            background: `url(images/minimize.png) no-repeat center center`,
          },
          '&.maximize::after': {
            background: `url(images/maximize.png) no-repeat center center`,
          }
        }
      }
      : {
        position: 'absolute',
        zIndex: '1',
        top: 0,
        left: 5,
        '&:hover': {
          'a::after': {
            opacity: '0.7'
          }
        },
        a: {
          display: 'inline-block',
          WebkitAppRegion: 'no-drag',
          width: 11,
          height: 11,
          borderRadius: 10,
          marginRight: 5,
          backgroundColor: Colors.osxWinOther,
          opacity: '0.7',
          transition: 'opacity 0.3s',
          '&::after': {
            content: '""',
            display: 'block',
            width: '100%',
            height: '100%',
            opacity: '0',
            transition: 'opacity 0.3s'
          },
          '&:hover': {
            opacity: '1'
          },
          '&.close': {
            backgroundColor: Colors.osxWinClose,
            '&::after': {
              background: `url(images/close.png) no-repeat center center`,
            }
          },
          '&.minimize::after': {
            background: `url(images/minimize.png) no-repeat center center`,
          },
          '&.maximize::after': {
            background: `url(images/maximize.png) no-repeat center center`,
          }
        }
      }
    },
    '.title-text': {
      height: 25,
      lineHeight: 25,
      textAlign: isWindows ? 'left' : 'center',
      padding: 5
    }
  })
  render () {
    const { children, title, noMaximize, noMinimize } = this.props
    return (
      <div className="title">
        {title ? <div className="title-text">{title}</div> : null}
        <div className="control-buttons">
          {!isWindows ? <a className="close" onClick={this.onClose}></a> : null}
          {!noMinimize ? <a className="minimize" onClick={this.onMinimize}></a> : null}
          {!noMaximize ? <a className="maximize" onClick={this.onMaximize}></a> : null}
          {isWindows ? <a className="close" onClick={this.onClose}></a> : null}
        </div>
        <div>
          {children}
        </div>
      </div>
    )
  }
}

export default TitleBar

