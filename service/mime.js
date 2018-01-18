import fileType from 'file-type'
import isSvg from 'is-svg'
import isUtf8 from 'isutf8'

// try to examine user data file type
export function examine (buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return 'error/empty'
  }
  const match = fileType(buffer)
  if (match) {
    return match.mime
  } else {
    let beginChar
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i]
      if (b !== 0x9 && b !== 0x10 && b !== 0x13 && b !== 0x20) {
        beginChar = String.fromCharCode(b)
        break
      }
    }
    if (beginChar === '<') {
      if (isSvg(buffer)) {
        return 'image/svg+xml'
      }
    }
    if (beginChar === '[' || beginChar === '{') {
      try {
        JSON.parse(buffer)
      } catch (err) {
        return 'application/json'
      }
    }
    if (isUtf8(buffer)) {
      return 'text/plain'
    }
    return 'error/unknown'
  }
}
