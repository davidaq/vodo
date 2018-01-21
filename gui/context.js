class Context extends Component {
  
  static childContextTypes = {
    window: PropTypes.object,
    nativeWindow: PropTypes.object
  }

  componentWillMount () {
    this.setState({ titleHeight: 0 })
  }

  getChildContext() {
    const { window, nativeWindow } = this.props
    return { window, nativeWindow }
  }

  @CSS({
    ':global': {
      'html, body, #APP': {
        padding: 0,
        margin: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        WebkitUserSelect: 'none',
        background: Colors.mainBG,
        fontFamily: '微软雅黑'
      },
      '*': {
        cursor: 'default'
      }
    }
  })
  render () {
    return this.props.children
  }
}

export default Context
