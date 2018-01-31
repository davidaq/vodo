import { parse as parseurl } from 'url'
import { Button, Field, Input, Tabs } from './form'
import { prompt } from '../pages/prompt'

@requireWindow
@autobind
class RuleEditor extends Component {

  onChooseToFile () {
    this.context.window.chooseFile(fpath => {
      this.props.onChange({
        ...this.props.value,
        to: {
          ...this.props.value.to,
          path: fpath
        }
      })
    })
  }

  onChange (section, field, value) {
    const update = { ...this.props.value[section] }
    if (field === 'protocol') {
      if (update.protocol === 'file:') {
        if (value === 'http:') {
          update.port = '80'
        } else if (value === 'https:') {
          update.port = '443'
        }
      } else if (value === 'https:' && update.protocol === 'http:' && update.port == 80) {
        update.port = '443'
      } else if (value === 'http:' && update.protocol === 'https:' && update.port == 443) {
        update.port = '80'
      }
    }
    if (field === 'path' && /^https?\:\/\//.test(value)) {
      const opt = parseurl(value)
      value = opt.path
      update.port = opt.port
      update.domain = opt.hostname
      update.protocol = opt.protocol
      if (!update.port) {
        update.port = opt.protocol === 'https:' ? '443' : '80'
      }
    }
    update[field] = value
    if (section === 'to') {
      if (update.protocol === 'file:') {
        update.port = ''
        update.domain = ''
      }
    }
    this.props.onChange({ ...this.props.value, [section]: update })
  }

  onAddHeader (field) {
    const title = ({
      injectRequestHeaders: '注入请求头',
      injectResponseHeaders: '注入响应头'
    })[field]
    prompt({ title, mode: 'kv' })
    .then(r => {
      r.key = r.key.trim()
      r.value = r.value.trim()
      if (r.key && r.value) {
        const oVal = this.props.value[field]
        const val = {}
        Object.keys(oVal).concat(r.key).sort().forEach((key) => {
          val[key] = oVal[key] || ''
        })
        val[r.key] = r.value
        this.props.onChange({
          ...this.props.value,
          [field]: val
        })
      }
    })
    .catch(err => null)
  }

  onEditHeader (field, key, oVal) {
    const defaultValue = { key, value: oVal }
    const title = ({
      injectRequestHeaders: '注入请求头',
      injectResponseHeaders: '注入响应头'
    })[field]
    prompt({ title, mode: 'kv', defaultValue })
    .then(r => {
      r.key = r.key.trim()
      r.value = r.value.trim()
      if (r.key && r.value) {
        const oVal = { ...this.props.value[field] }
        delete oVal[key]
        const val = {}
        Object.keys(oVal).concat(r.key).sort().forEach((key) => {
          val[key] = oVal[key] || ''
        })
        val[r.key] = r.value
        this.props.onChange({
          ...this.props.value,
          [field]: val
        })
      }
    })
  }
  
  onRemoveHeader (field, key) {
    const val = { ...this.props.value[field] }
    delete val[key]
    this.props.onChange({ ...this.props.value, [field]: val })
  }

  @CSS({
    '.half': {
      display: 'inline-block',
      width: '49.8%',
      boxSizing: 'border-box',
      '&.left': {
        paddingRight: 5,
        borderRight: '1px solid #E0E0E0'
      },
      '&.right': {
        paddingLeft: 5,
        borderLeft: '1px solid #FFF'
      }
    },
    '.headers': {
      height: 70,
      padding: '2px 5px',
      overflow: 'auto',
      background: '#FFF',
      border: '1px solid #CCC',
      boxSizing: 'border-box',
      '.header': {
        display: 'flex',
        flexFlow: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        '.kv': {
          flex: 'auto',
          '.key, .value': {
            display: 'inline-block',
            verticalAlign: 'middle',
            width: '47%',
            fontSize: 11,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          },
          '.colon': {
            '&::after': {
              content: '":"', 
            },
            display: 'inline-block',
            width: '5%',
            verticalAlign: 'middle',
            textAlign: 'center',
            fontSize: 11
          }
        },
        '.control': {
          flex: 'none',
        }
      }
    },
    '.file': {
      display: 'inline-block',
      width: '100%',
      position: 'relative',
      '.fa': {
        position: 'absolute',
        top: 2,
        right: 2,
        padding: 5,
        transition: 'background 0.3s',
        cursor: 'pointer',
        background: '#FFF',
        '&:hover': {
          background: '#EEE'
        }
      }
    }
  })
  render() {
    const { value, onChange } = this.props
    return (
      <div>
        <div className="half left">
          <Field label="匹配协议">
            <Tabs
              options={[
                { label: 'http', value: 'http:' },
                { label: 'https', value: 'https:' }
              ]}
              value={value.from.protocol}
              onChange={val => this.onChange('from', 'protocol', val)}
            />
          </Field>
          <div>
            <div style={{ width: '69%', display: 'inline-block' }}>
              <Field label="匹配域名">
                <Input
                  value={value.from.domain}
                  onChange={val => this.onChange('from', 'domain', val)}
                />
              </Field>
            </div>
            <div style={{ width: '1.5%', display: 'inline-block' }} />
            <div style={{ width: '29%', display: 'inline-block' }}>
              <Field label=" 端口" labelWidth={30}>
                <Input
                  value={value.from.port}
                  type="number"
                  onChange={val => this.onChange('from', 'port', val)}
                />
              </Field>
            </div>
          </div>
          <Field label="匹配路径">
            <Input
              value={value.from.path}
              onChange={val => this.onChange('from', 'path', val)}
            />
            <br /><br />
            <Tabs
              options={[
                { label: '准确匹配', value: true },
                { label: '扩展匹配', value: false }
              ]}
              value={value.from.exact}
              onChange={val => this.onChange('from', 'exact', val)}
            />
          </Field>
          <Field label="注入请求头">
            <div className="headers">
              {Object.keys(value.injectRequestHeaders).map(key => {
                const val = value.injectRequestHeaders[key]
                return (
                  <div className="header" key={key}>
                    <div className="kv">
                      <div className="key" title={key}>
                        {key}
                      </div>
                      <div className="colon" />
                      <div className="value" title={val}>
                        {val}
                      </div>
                    </div>
                    <div className="control">
                      <Button onClick={() => this.onEditHeader('injectRequestHeaders', key, val)}>编辑</Button>
                      <Button onClick={() => this.onRemoveHeader('injectRequestHeaders', key)} style={{ backgroundColor: '#D33' }}>删除</Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button onClick={() => this.onAddHeader('injectRequestHeaders')}>添加</Button>
          </Field>
        </div>
        <div className="half right">
          <Field label="替换协议">
            <Tabs
              options={[
                { label: 'http', value: 'http:' },
                { label: 'https', value: 'https:' },
                { label: '本地文件', value: 'file:' }
              ]}
              value={value.to.protocol}
              onChange={val => this.onChange('to', 'protocol', val)}
            />
          </Field>
          <div>
            <div style={{ width: '69%', display: 'inline-block' }}>
              <Field label="替换域名">
                <Input
                  value={value.to.domain}
                  onChange={val => this.onChange('to', 'domain', val)}
                />
              </Field>
            </div>
            <div style={{ width: '1.5%', display: 'inline-block' }} />
            <div style={{ width: '29%', display: 'inline-block' }}>
              <Field label="端口" labelWidth={30}>
                <Input
                  value={value.to.port}
                  type="number"
                  onChange={val => this.onChange('to', 'port', val)}
                />
              </Field>
            </div>
          </div>
          <Field label="替换路径">
            {value.to.protocol === 'file:' ? (
              <div className="file">
                <Input
                  value={value.to.path}
                  onChange={val => this.onChange('to', 'path', val)}
                  style={{ paddingRight: 28 }}
                />
                <a onClick={this.onChooseToFile} className="fa fa-folder-o" />
              </div>
            ) : (
              <Input
                value={value.to.path}
                onChange={val => this.onChange('to', 'path', val)}
              />
            )}
            <br /><br />
            <Tabs
              options={[
                { label: '准确替换', value: true },
                { label: '扩展替换', value: false }
              ]}
              value={value.to.exact}
              onChange={val => this.onChange('to', 'exact', val)}
            />
          </Field>
          <Field label="注入响应头">
            <div className="headers">
              {Object.keys(value.injectResponseHeaders).map(key => {
                const val = value.injectResponseHeaders[key]
                return (
                  <div className="header" key={key}>
                    <div className="kv">
                      <div className="key" title={key}>
                        {key}
                      </div>
                      <div className="colon" />
                      <div className="value" title={val}>
                        {val}
                      </div>
                    </div>
                    <div className="control">
                      <Button onClick={() => this.onEditHeader('injectResponseHeaders', key, val)}>编辑</Button>
                      <Button onClick={() => this.onRemoveHeader('injectResponseHeaders', key)} style={{ backgroundColor: '#D33' }}>删除</Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button onClick={() => this.onAddHeader('injectResponseHeaders')}>添加</Button>
          </Field>
        </div>
      </div>
    )
  }
}

export default RuleEditor

