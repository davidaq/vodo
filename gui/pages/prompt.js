import { Button, Input } from '../components/form'
import TitleBar from '../components/title-bar'

@requireWindow
@autobind
class Prompt extends Component {
  componentWillMount () {
    const value = this.props.defaultValue || (this.props.mode === 'kv' ? { key: '', value: ''} : '')
    console.log(this.props, value)
    this.setState({ value })
  }

  onOk () {
    this.props.resolve(this.state.value)
    this.context.nativeWindow.close(true)
  }

  onCancel () {
    this.context.nativeWindow.close()
  }

  render () {
    const { value } = this.state
    return (
      <div>
        <TitleBar title={this.props.title} noMinimize={true} noMaximize={true}></TitleBar>
        <div style={{ padding: '5px' }}>
          {this.props.mode === 'kv' ? (
            <div>
              <Input style={{ width: '49%' }} placeholder="key" value={value.key} onChange={val => this.setState({ value: { ...value, key: val }})} />
              <Input style={{ width: '49%', marginLeft: '1%' }} placeholder="value" value={value.value} onChange={val => this.setState({ value: { ...value, value: val }})} />
            </div>
          ) : (
            <Input value={value} onChange={val => this.setState({ value: val })}  />
          )}
          <Button onClick={this.onOk}>确定</Button>
          <Button style={{ backgroundColor: '#6B6B6B' }} onClick={this.onCancel}>取消</Button>
        </div>
      </div>
    )
  }
}

export default Prompt

export const prompt = (props) => {
  return new Promise((resolve, reject) => {
    const options = {
      props: { ...props, resolve },
      width: 400,
      height: 110,
      resizable: false,
      always_on_top: true,
      // show_in_taskbar: false
    }
    openUI('prompt', options, win => {
      win.on('close', () => {
        win.close(true)
        reject(new Error('canceld'))
      })
    })
  })
}
