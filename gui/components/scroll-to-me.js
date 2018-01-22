import { findDOMNode } from 'react-dom'

class ScrollToMe extends Component {
  
  componentDidMount () {
    setTimeout(() => {
      const dom = findDOMNode(this)
      let scroller = dom
      while (scroller) {
        scroller = scroller.parentElement
        if (/scrollable/.test(scroller.className)) {
          break
        }
      }
      const domRect = dom.getBoundingClientRect()
      const scrRect = scroller.getBoundingClientRect()
      if (domRect.top < scrRect.top || domRect.bottom > scrRect.bottom) {
        let targetTop = Math.round(domRect.top - scrRect.top + scrRect.height / 2)
        if (targetTop < 0) {
          targetTop = 0
        }
        scroller.scrollTop = targetTop
      }
    }, 100)
  }

  render () {
    return (
      <span />
    )
  }
}

export default ScrollToMe

