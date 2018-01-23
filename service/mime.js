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
      const p = qs.parse(buffer.toString())
      for (const key in p) {
        if (key.length > 30) {
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
