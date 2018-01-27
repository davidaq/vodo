import { findDOMNode } from 'preact-compat'
import DataViewer from './data-viewer'
import { Tabs } from './form'
import qs from 'qs'

@requireWindow
@autobind
class BodyDisplayer extends Component {
  componentWillMount () {
    this.setState({ imgW: 0, imgH: 0, text: '', data: null, showRaw: false })
  }

  componentDidMount () {
    const { mime, href } = this.props
    const [category, spec] = mime.split('/')
    if (category === 'image') {
      this.context.window.addEventListener('resize', this.onResizeImage)
    } else if (category === 'text') {
      fetch(href)
      .then(r => r.text())
      .then(text => this.setState({ text, lines: text.split(/\r?\n/) }))
    } else if (category === 'application' && spec === 'json') {
      fetch(href)
      .then(r => r.text())
      .then(text => this.setState({ text, lines: text.split(/\r?\n/), data: JSON.parse(text) }))
    } else if (category === 'application' && spec === 'x-www-form-urlencoded') {
      fetch(href)
      .then(r => r.text())
      .then(text => this.setState({ text, lines: text.split(/\r?\n/), data: qs.parse(text) }))
    }
  }

  componentWillUnmount () {
    if (/^image/.test(this.props.mime)) {
      this.context.window.removeEventListener('resize', this.onResizeImage)
    }
  }

  onResizeImage () {
    const $el = findDOMNode(this)
    const img = $el.querySelector('img')
    const oW = img.naturalWidth || 0
    const oH = img.naturalHeight || 0
    if (oW && oH) {
      this.setState({ imgW: oW, imgH: oH })
      let { width: cW, height: cH } = $el.getBoundingClientRect()
      cW -= 50
      cH -= 50
      let w = oW
      let h = oH
      if (w > cW) {
        w = cW
        h = w / oW * oH
      }
      if (h > cH) {
        h = cH
        w = h / oH * oW
      }
      w = Math.round(w)
      h = Math.round(h)
      img.width = w
      img.height = h
    }
  }

  @CSS({
    '@keyframes gloom': {
      '0%': {
        background: '#EEE'
      },
      '20%': {
        background: '#FFF'
      },
      '40%': {
        background: '#EEF'
      },
      '60%': {
        background: '#EFE'
      },
      '80%': {
        background: '#FEE'
      },
      '100%': {
        background: '#EEE'
      }
    },
    '.image': {
      position: 'relative',
      width: '100%',
      height: 0,
      paddingBottom: '56%',
      animation: 'gloom 10s infinite',
      '.size': {
        position: 'absolute',
        top: 5,
        left: 5,
        fontSize: 10
      },
      'img': {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    },
    '.text': {
      background: '#FFF',
      '.line': {
        display: 'flex',
        flexFlow: 'row',
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace',
        '.num': {
          flex: 'none',
          overflow: 'hidden',
          width: 50,
          textAlign: 'right',
          background: 'rgba(0, 0, 0, 0.1)',
          color: '#777',
          paddingRight: 5
        },
        '.content': {
          flex: 'auto',
          WebkitUserSelect: 'initial',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          cursor: 'text',
          paddingLeft: 5
        },
        '&:nth-child(even)': {
          background: '#FFC'
        }
      }
    }
  })
  render () {
    const { href, mime } = this.props
    const [category, spec] = mime.split('/')
    return (
      <div>
        {category === 'image' ? (
          <div className="image">
            <div className="size">
              宽：{this.state.imgW}
              ，
              高：{this.state.imgH}
            </div>
            <img src={href} onLoad={this.onResizeImage} />
          </div>
        ) : category === 'text' ? (
          <div className="text">
            {this.state.lines && this.state.lines.map((line, index) => (
              <div className="line" key={index}>
                <div className="num">{index + 1}</div>
                <div className="content">{line}</div>
              </div>
            ))}
          </div>
        ) : this.state.data ? (
          <div>
            <center>
              <Tabs
                options={[{ label: '文本', value: true }, { label: '解析', value: false }]}
                value={this.state.showRaw}
                onChange={val => this.setState({ showRaw: val })}
              />
            </center>
            {this.state.showRaw ? (
              <div className="text">
                {this.state.lines && this.state.lines.map((line, index) => (
                  <div className="line" key={index}>
                    <div className="num">{index + 1}</div>
                    <div className="content">{line}</div>
                  </div>
                ))}
              </div>
            ) : (
              <DataViewer data={this.state.data} />
            )}
          </div>
        ) : null}
      </div>
    )
  }
}

export default BodyDisplayer
