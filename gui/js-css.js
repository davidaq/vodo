import { Component } from 'react'

let idCounter = 0

const CSS = (style) => {
  idCounter++
  const CSSModID = idCounter
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
  const walkStyle = (obj, parent, keyInParent, scope = []) => {
    if (obj) {
      if (typeof obj === 'object') {
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
      } else {
        if (parent) {
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
      }
    }
    return scope
  }
  const entries = walkStyle(style)
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
      if (/^\:global\s+/.test(path)) {
        path = path.replace(/^\:global\s+/, '')
      } else if (scoped) {
        path += `[data-c-${CSSModID}]`
      }
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
  // console.log(cssContent(entries))
  
  let styleInjected = false
  return (target) => {
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
    let oRender
    const nRender = function (...args) {
      const element = oRender.call(this, ...args)
      return markElements(element)
    }
    if (target instanceof Component) {
      oRender = target.prototype.render
      target.prototype.render = nRender
      return target
    } else {
      oRender = target
      return nRender
    }
  }
}

export default CSS

