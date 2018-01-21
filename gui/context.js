class Context extends Component {
  
  static childContextTypes = {
    window: PropTypes.object,
    nativeWindow: PropTypes.object
  }

  getChildContext() {
    const { window, nativeWindow } = this.props
    return { window, nativeWindow }
  }
  @CSS({
    ':global': {
      'html, body': {
        padding: 0,
        margin: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }
    }
  })
  render () {
    return this.props.children
  }
}

export default Context
