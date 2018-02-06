import classnames from 'classnames'

export const Field = CSS({
  '.field': {
    display: 'flex',
    flexFlow: 'row',
    marginTop: 5,
    '.label': {
      flex: 'none',
      width: 70,
      fontSize: 12,
      lineHeight: 30,
      color: '#555'
    },
    '.input': {
      flex: 'auto'
    },
    '.tip': {
      flex: 'auto',
      minWidth: '40%',
      fontSize: 11,
      color: '#AAA',
      lineHeight: 16,
      paddingTop: 7,
      paddingLeft: 5
    }
  }
})((props) => {
  const style = {}
  if (props.labelWidth) {
    let width = props.labelWidth
    if (typeof width === 'number') {
      width += 'px'
    }
    style.width = width
  }
  return (
    <div className="field">
      <div className="label" style={style}>
        {props.label}
      </div>
      <div className="input">
        {props.children}
      </div>
      {props.tip ? <div className="tip">{props.tip}</div> : null}
    </div>
  )
})

export const Tip = CSS({
  '.tip': {
    display: 'inline-block',
    position: 'relative',
    marginLeft: 5,
    '&:hover .expandable': {
      display: 'block'
    },
    '.expandable': {
      display: 'none',
      position: 'absolute',
      zIndex: 1,
      top: 0,
      left: 15,
      width: 100,
      padding: 5,
      background: '#FFF',
      boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.3)'
    }
  }
})((props) => (
  <div className="tip">
    <i className="fa fa-question-circle" />
    <div className="expandable">
      {props.children}
    </div>
  </div>
))

export const uniformInput = (Origin, defaultValue) => {
  @autobind
  class UniformedInput extends Component {
    componentWillMount () {
      let value
      if (this.props.hasOwnProperty('value')) {
        value = this.props.value
      } else if (this.props.hasOwnProperty('defaultValue')) {
        value = this.props.defaultValue
      } else {
        value = defaultValue
      }
      this.setState({ value })
    }

    getValue () {
      if (this.props.hasOwnProperty('value')) {
        return this.props.value
      } else {
        return this.state.value
      }
    }

    onChange (changeVal) {
      if (changeVal && typeof changeVal === 'object' && changeVal.target && typeof changeVal.target === 'object') {
        changeVal = changeVal.target.value
      }
      this.setState({ value: changeVal })
      this.props.onChange && this.props.onChange(changeVal)
    }

    render () {
      const props = { ...this.props }
      delete props.value
      delete props.defaultValue
      delete props.onChange
      return <Origin {...props} value={this.getValue()} onChange={this.onChange} onInput={this.onChange} />
    }
  }
  return UniformedInput
}

const inputCSS = CSS({
  '.input': {
    display: 'inline-block',
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 30,
    padding: 5,
    border: '1px solid #CCC',
    cursor: 'text',
    WebkitUserSelect: 'initial',
    outline: 'none',
    transition: 'box-shadow 0.3s',
    resize: 'none',
    '&:focus': {
      boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.3)'
    }
  }
})

export const Input = uniformInput(
  inputCSS(({ className, ...props }) => (
    <input className={classnames(className, 'input')} {...props} />
  ))
)

export const Textarea = uniformInput(
  inputCSS(({ className, ...props }) => (
    <textarea className={classnames(className, 'input')} {...props} />
  ))
)

export const Checkbox = uniformInput(
  CSS({
    '.checkbox': {
      display: 'inline-block',
      fontSize: 12,
      marginRight: 20,
      color: '#555',
      '.icon': {
        display: 'inline-block',
        width: 14,
        textAlign: 'left'
      },
    }
  })(({ value, className, children, onChange, onClick, ...props}) => (
    <div {...props} className={classnames(className, 'checkbox')} onClick={(...args) => { onChange(!value); onClick && onClick(...args) }}>
      <span className="icon">
        <i className={classnames('fa', value ? 'fa-check-square-o' : 'fa-square-o')} />
      </span>
      {children}
    </div>
  )),
  false
)

export const Button = CSS({
  '.button': {
    display: 'inline-block',
    cursor: 'pointer',
    padding: '5px 12px',
    marginTop: 5,
    color: '#FFF',
    fontSize: 12,
    background: Colors.buttonPrimary,
    opacity: '1',
    boxShadow: '1px 1px 3px rgba(0, 0, 0, 0)',
    transition: 'opacity 0.3s, box-shadow 0.3s',
    '&:hover': {
      opacity: '0.8',
      boxShadow: '1px 1px 5px rgba(0, 0, 0, 0.6)'
    }
  }
})(({ className, children, ...props }) => (
  <a className={classnames(className, 'button')} {...props}>{children}</a>
))

export const Tabs = uniformInput(
  CSS({
    '.tabs': {
      display: 'inline-block',
      border: '1px solid #CCC',
      borderRadius: 5,
      overflow: 'hidden'
    },
    '.tab': {
      display: 'inline-block',
      padding: 5,
      width: 70,
      fontSize: 10,
      lineHeight: 16,
      color: '#AAA',
      borderLeft: '1px solid #CCC',
      transition: 'background 0.3s, box-shadow 0.3s',
      background: '#EEE',
      textAlign: 'center',
      '&.first': {
        borderLeft: 'none'
      },
      '&:hover': {
        boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.3)'
      },
      '&.active': {
        color: '#333',
        fontSize: 13,
        background: '#FFF'
      }
    }
  })(({ options, value, onChange }) => (
    <div className="tabs">
      {options.map((item, index) => (
        <div
          key={item.value}
          className={classnames('tab', { first: index === 0, active: value === item.value })}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </div>
      ))}
    </div>
  ))
)
