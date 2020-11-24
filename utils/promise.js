const { mapIterable } = require('utils/data')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const all = (iterable, fn) => Promise.all(fn ? mapIterable(iterable, fn) : iterable)

async function asyncAssign (dst, src) {
  const keys = Reflect.ownKeys(src)
  const values = await Promise.all(keys.map(key => src[key]))

  keys.forEach((key, i) => {
    dst[key] = values[i]
  })

  return dst
}

module.exports = {
  delay,
  all,
  asyncAssign,
}
