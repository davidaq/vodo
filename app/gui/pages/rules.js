import { Checkbox, Button } from '../components/form'
import RuleEditor from '../components/rule-editor'
import { prompt } from './prompt'

@requireWindow
@autobind
class Rules extends Component {
  componentWillMount () {
    this.updateFromStore()
    eventBus.on('service:store', this.updateFromStore)
  }

  componentDidMount () {
    const el = this.base
    el.addEventListener('contextmenu', ev => {
      ev.preventDefault()
      ev.stopPropagation()
      const menu = this.context.window.createMenu()
      menu.append(new nw.MenuItem({
        label: '添加新规则',
        click: this.onAddNew
      }))
      let { mouseX, mouseY } = this.context.window
      menu.popup(mouseX, mouseY)
    })
  }

  updateFromStore () {
    this.setState({
      rules: eventBus.store && eventBus.store.replaceRules
    })
  }

  onChangeRule (update, index) {
    const replaceRules = [
      ...this.state.rules.slice(0, index),
      {
        ...this.state.rules[index],
        ...update
      },
      ...this.state.rules.slice(index + 1),
    ]
    fetch(`${serviceAddr}/app-data?shallow`, {
      method: 'PUT',
      body: JSON.stringify({ replaceRules })
    })
  }

  promptEdit (defaultValue) {
    const ret = prompt({
      title: '地址替换规则',
      comp: RuleEditor,
      defaultValue
    }, {
      height: 350,
      width: 780
    })
    this.promptWin = ret
    ret.catch(err => {
      if (this.promptWin === ret) {
        this.promptWin = null
      }
    })
    return ret
  }

  onEdit (index) {
    this.promptWin && this.promptWin.close()
    const rule = this.state.rules[index]
    this.promptEdit(rule)
    .then(update => {
      this.onChangeRule(update, index)
    })
  }

  onMoveUp (index) {
    if (index < 1) {
      return
    }
    this.promptWin && this.promptWin.close()
    const replaceRules = [...this.state.rules]
    const tmp = replaceRules[index]
    replaceRules[index] = replaceRules[index - 1]
    replaceRules[index - 1] = tmp
    fetch(`${serviceAddr}/app-data?shallow`, {
      method: 'PUT',
      body: JSON.stringify({ replaceRules })
    })
  }

  onMoveDown (index) {
    if (index >= this.state.rules.length - 1) {
      return
    }
    this.promptWin && this.promptWin.close()
    const replaceRules = [...this.state.rules]
    const tmp = replaceRules[index]
    replaceRules[index] = replaceRules[index + 1]
    replaceRules[index + 1] = tmp
    fetch(`${serviceAddr}/app-data?shallow`, {
      method: 'PUT',
      body: JSON.stringify({ replaceRules })
    })
  }

  onRemove (index) {
    if (confirm('确认删除？')) {
      this.promptWin && this.promptWin.close()
      const replaceRules = [
        ...this.state.rules.slice(0, index),
        ...this.state.rules.slice(index + 1),
      ]
      fetch(`${serviceAddr}/app-data?shallow`, {
        method: 'PUT',
        body: JSON.stringify({ replaceRules })
      })
    }
  }

  onCopy (index) {
    this.onAddNew(this.state.rules[index])
  }

  onAddNew (copyFrom) {
    this.promptWin && this.promptWin.close()
    const rule = copyFrom || {
      enabled: true,
      from: {
        protocol: 'http:',
        domain: '',
        port: '80',
        path: '',
        exact: true
      },
      to: {
        protocol: 'http:',
        domain: '',
        port: '80',
        path: '',
        exact: true
      },
      injectRequestHeaders: {},
      injectResponseHeaders: {}
    }
    this.promptEdit(rule)
    .then(update => {
      const replaceRules = [
        ...this.state.rules,
        update
      ]
      fetch(`${serviceAddr}/app-data?shallow`, {
        method: 'PUT',
        body: JSON.stringify({ replaceRules })
      })
    })
  }

  @CSS({
    '.rules': {
      height: '100%',
      overflow: 'auto',
      background: '#FFF'
    },
    '.row': {
      display: 'flex',
      flexFlow: 'row',
      fontSize: 12,
      lineHeight: 35,
      height: 35,
      overflow: 'hidden',
      transition: 'background 0.3s',
      '&:nth-child(odd)': {
        background: '#F7F7F7'
      },
      '&:hover': {
        background: '#EEE'
      },
      '.col': {
        flex: 'auto',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        '&.left': {
          flex: 'none',
          width: 40,
          textAlign: 'center'
        },
        '&.right': {
          flex: 'none',
          width: 110,
          textAlign: 'center',
          'a.fa': {
            padding: '3px 4px',
            cursor: 'pointer',
            transition: 'background 0.3s',
            borderRadius: 4,
            '&:hover': {
              background: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        '.half': {
          display: 'inline-block',
          width: '49%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }
      },
      '&.header': {
        background: '#E7E7E7',
        fontWeight: 'bold'
      },
    },
    '.tools': {
      textAlign: 'center',
      padding: 10
    }
  })
  render () {
    const { rules } = this.state
    if (!Array.isArray(rules)) {
      return <div />
    }
    return (
      <div className="rules">
        <div className="row header">
          <div className="col left">
            <strong>启用</strong>
          </div>
          <div className="col">
            <div className="half">
              <strong>匹配</strong>
            </div>
            <div className="half">
              <strong>替换</strong>
            </div>
          </div>
          <div className="col right">
            <strong>操作</strong>
          </div>
        </div>
        {rules.map((rule, index) => (
          <div className="row" key={index}>
            <div className="col left">
              <Checkbox style={{ marginRight: 0 }} value={rule.enabled} onChange={() => this.onChangeRule({ enabled: !rule.enabled }, index)} />
            </div>
            <div className="col">
              <div className="half">
                {rule.from.protocol}//{rule.from.domain}:{rule.from.port}{rule.from.path || '/*'}{rule.from.path && rule.from.exact ? '' : '*'}
              </div>
              <div className="half">
                {rule.to.protocol !== 'file:' ? (
                  <span>
                    {rule.to.protocol}//{rule.to.domain}:{rule.to.port}{rule.to.path || '/*'}{rule.to.path && rule.to.exact ? '' : '*'}
                  </span>
                ) : (
                  <span>
                    本地文件 - {rule.to.path}{rule.to.path && rule.to.exact ? '' : '*'}
                  </span>
                )}
              </div>
            </div>
            <div className="col right">
              <a title="前置" onClick={() => this.onMoveUp(index)} className="fa fa-long-arrow-up"></a>
              <a title="后置" onClick={() => this.onMoveDown(index)} className="fa fa-long-arrow-down"></a>
              <a title="修改" onClick={() => this.onEdit(index)} className="fa fa-edit"></a>
              <a title="复制" onClick={() => this.onCopy(index)} className="fa fa-copy"></a>
              <a title="删除" onClick={() => this.onRemove(index)} className="fa fa-trash-o"></a>
            </div>
          </div>
        ))}
        <div className="tools">
          <Button onClick={() => this.onAddNew()} style={{ padding: 10 }}>添加新规则</Button>
        </div>
      </div>
    )
  }
}

export default Rules

