import fileType from 'file-type'
import isSvg from 'is-svg'
import isUtf8 from 'isutf8'
import qs from 'qs'

// try to examine user data file type
export function examine (buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return 'error/empty'
  }
  const match = fileType(buffer)
  if (match) {
    return match.mime
  } else if (isUtf8(buffer)) {
    if (isSvg(buffer)) {
      return 'image/svg+xml'
    }
    try {
      JSON.parse(buffer)
      return 'application/json'
    } catch (err) {
    }
    try {
      const parts = buffer.toString().split('&').map(v => v.split('='))
      if (parts.length === 0 && !parts[0][1]) {
        return 'text/plain'
      }
      for (let i = 0; i < parts.length; i++) {
        const [key, val] = parts[i]
        if (encodeURIComponent(decodeURIComponent(key)) !== key) {
          return 'text/plain'
        }
      }
      return 'application/x-www-form-urlencoded'
    } catch (err) {
    }
    return 'text/plain'
  }
  return 'error/unknown'
}
