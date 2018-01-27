import { EventEmitter } from 'events'

let idCounter = 0

export const styleEv = new EventEmitter()
styleEv.content = ''
styleEv.hash = ''

const CSS = (style) => {
  idCounter++
  const CSSModID = idCounter
  const toCssKey = (key) => {
    return key.replace(/[A-Z]+/g, (m) => `-${m.toLowerCase()}`)
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
  const walkStyle = (obj, parent, keyInParent, scope = []) => {
    if (obj && typeof obj === 'object' && !obj.$IS_CSS_VAL) {
      if (keyInParent && /^\@keyframes/.test(keyInParent)) {
        const name = keyInParent.split(/\s+/)[1]
        idCounter++
        const id = `${name}-${idCounter}`
        const keyframes = {
          id,
          path: parent.path.concat([keyInParent]),
          frames: walkStyle(obj)
        }
        parent.keyframes[name] = id
        scope.push(keyframes)
      } else {
        const entry = {
          path: parent ? parent.path.concat([keyInParent]) : [],
          keyframes: {},
          props: [],
          parent
        }
        scope.push(entry)
        Object.keys(obj).forEach(key => {
          const val = obj[key]
          walkStyle(val, entry, key, scope)
        })
      }
    } else if (parent) {
      const key = toCssKey(keyInParent)
      let val = toCssVal(obj)
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
        isProp: true,
        key,
        value: val
      })
    }
    return scope
  }
  const cssBlock = (block, scoped) => {
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
          path = pathItem.split(',').map(item => {
            item = item.trim()
            if (item.indexOf('&') > -1) {
              return path.split(',').map(part => item.replace(/\&/g, part)).join(',')
            } else {
              return path + ' ' + item
            }
          }).join(',')
        }
      })
      path = path.split(',').map(item => {
        item = item.trim()
        if (/^\:global\s+/.test(item)) {
          return item.replace(/^\:global\s+/, '')
        } else if (scoped) {
          let psuedo = ''
          item = item.replace(/(\:+[a-z]+)+$/i, (m) => {
            psuedo = m
            return ''
          })
          return `${item}[data-c-${CSSModID}]${psuedo}`
        } else {
          return item
        }
      }).join(',')
      let ret = `${path} {${block.props.map(v => `${v.key}:${v.value};`).join('')}}\n`
      wrap.forEach(w => {
        ret = `${w} {\n${ret}}\n`
      })
      return ret
    }
  }
  const cssContent = (entries, scoped = true) =>  entries.map((entry) => {
    if (entry.frames) {
      const frames = cssContent(entry.frames, false)
      return `@keyframes ${entry.id} {\n${frames}}\n`
    } else if (entry.isProp) {
      return `${entry.key}:${entry.value};`
    } else {
      return cssBlock(entry, scoped)
    }
  }).join('')
  
  styleEv.content += cssContent(walkStyle(style))
  styleEv.hash += `#${CSSModID}`
  styleEv.emit('style')

  return (target, name, descriptor) => {
    const markElements = element => {
      if (element) {
        if (Array.isArray(element)) {
          return element.map(markElements)
        } else if (typeof element === 'object') {
          return {
            ...element,
            children: markElements(element.children),
            props: {
              ...element.props,
              [`data-c-${CSSModID}`]: '',
              children: element.props && markElements(element.props.children)
            },
            attributes: {
              ...element.attributes,
              [`data-c-${CSSModID}`]: '',
              children: element.attributes && markElements(element.attributes.children)
            }
          }
        }
      }
      return element
    }
    let oRender
    const nRender = function (...args) {
      const result = markElements(oRender.call(this, ...args))
      return result
    }
    if (name && descriptor) {
      oRender = descriptor.value
      descriptor.value = nRender
    } else {
      if (target.prototype && target.prototype.render) {
        throw new Error('CSS should be annoted on the render method instead of the class')
      }
      oRender = target
      return nRender
    }
  }
}

export default CSS

