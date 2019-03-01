const _ = require('lodash')

function mapper (mapping) {
  const entries = Object.entries(mapping).map(([name, fx]) => [name, fx, _.isFunction(fx)])

  function mapItem (item) {
    const res = {}

    // optimized for performance (this code is potentially run on large datasets)
    for (const [ name, fx, isFun ] of entries) {
      const value = isFun ? fx(item) : item[fx]

      // ignore undefined values, useful if used to prepare data for DB
      if (value !== void 0) {
        res[name] = value
      }
    }

    return res
  }

  const map = data => {
    if (!data) return null
    return _.isArray(data) ? data.map(mapItem) : mapItem(data)
  }

  map.mapping = { ...mapping }
  return map
}

module.exports = {
  mapper,
}
