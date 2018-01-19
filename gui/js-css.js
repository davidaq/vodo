
let idCounter = 0

const CSS = (style) => {
  idCounter++
  const CSSModID = idCounter
  const entries = []
  const toCssKey = (key) => {
    return key.replace(/[A-Z]+/, (m) => `-${m.toLowerCase()}`)
  }
  const toCssVal = (val) => {
    if (typeof val === 'number') {
      return `${val}px`
    } else if (val) {
      if (typeof val === 'object') {
        return val
      }
      return `${val}`.trim()
    } else {
      return ''
    }
  }
  const walkStyle = (obj, parent, keyInParent, notEntry = false) => {
    if (obj) {
      if (typeof obj === 'object') {
        if (keyInParent && /^\@keyframes/.test(keyInParent)) {
          const name = keyInParent.split(/\s+/)[1]
          idCounter++
          const id = `${name}-${idCounter}`
          const keyframes = {
            id,
            path: parent.path.concat([keyInParent]),
            frames: []
          }
          parent.keyframes[name] = id
          entries.push(keyframes)
          Object.keys(obj).forEach(frameKey => {
            const frameProps = obj[frameKey]
            const frame = {
              path: [frameKey],
              keyframes: {},
              props: [],
              parent
            }
            keyframes.frames.push(frame)
            Object.keys(frameProps).forEach(key => {
              const val = frameProps[key]
              walkStyle(val, frame, key, true)
            })
          })
        } else {
          const entry = {
            path: parent ? parent.path.concat([keyInParent]) : [],
            keyframes: {},
            props: [],
            parent
          }
          if (notEntry) {
            parent.props.push({
              key: toCssVal(keyInParent),
              value: entry
            })
          } else {
            entries.push(entry)
          }
          Object.keys(obj).forEach(key => {
            const val = obj[key]
            walkStyle(val, entry, key, notEntry)
          })
        }
      } else {
        if (parent) {
          let val = toCssVal(obj)
          const key = toCssKey(keyInParent)
          if (key === 'animation' || key === 'animation-name') {
            const animationName = val.split(/\s+/)[0]
            if (animationName) {
              let search = parent
              while (search) {
                const convName = search.keyframes[animationName]
                if (convName) {
                  val = val.replace(animationName, convName)
                  break
                }
                search = search.parent
              }
            }
          }
          parent.props.push({
            key,
            value: val
          })
        }
      }
    }
  }
  walkStyle(style)
  const cssBlock = (block) => {
    console.log(block.path, block.props)
    if (block.path.length === 0 || block.props.length === 0) {
      return ''
    } else {
      let path = ''
      const wrap = []
      block.path.forEach(pathItem => {
        pathItem = pathItem.trim()
        if (pathItem[0] === '@') {
          wrap.push(pathItem)
        } else {
          if (pathItem.indexOf('&') > -1) {
            path = pathItem.replace(/\&/g, path)
          } else {
            if (path) {
              path += ' '
            }
            path += pathItem
          }
        }
      })
      let ret = `${path} {${block.props.map(v => `${v.key}:${v.value};`).join('')}}`
      wrap.forEach(w => {
        ret = `${w} {\n${ret}\n}`
      })
      return ret
    }
  }
  const cssContent = entries.map((entry) => {
    if (entry.frames) {
      console.log(entry.frames)
      return `@keyframes ${entry.id} {\n${entry.frames.map(cssBlock).join('\n')}\n}`
    } else {
      return cssBlock(entry)
    }
  }).join('\n')
  console.log(cssContent)
  return (Component) => {
    const oRender = Component.prototype.render
    const markElements = element => {
      if (element) {
        if (Array.isArray(element)) {
          return element.map(markElements)
        } else if (typeof element === 'object') {
          const sourceProps = element.props || {}
          return Object.assign({}, element, {
            props: Object.assign({}, sourceProps, {
              [`data-c-${CSSModID}`]: '',
              children: markElements(sourceProps.children)
            })
          })
        }
      }
      return element
    }
    Component.prototype.render = function (...args) {
      const element = oRender.call(this, ...args)
      return markElements(element)
    }
    return Component
  }
}

export default CSS

