const _ = require('lodash')

function mapper (mapping) {
  const props = [
    ...Object.getOwnPropertyNames(mapping),
    ...Object.getOwnPropertySymbols(mapping),
  ]
  .map(key => {
    const val = mapping[key]
    const isFn = _.isFunction(val)
    return { key, val, isFn }
  })

  function mapItem (src) {
    const dst = {}
    for (const { key, val, isFn } of props) {
      const y = isFn ? val(src) : src[val]
      if (y !== undefined) dst[key] = y
    }
    return dst
  }

  function map (data) {
    if (!data) return null
    return _.isArray(data) ? data.map(mapItem) : mapItem(data)
  }

  map.mapping = { ...mapping }
  return map
}

module.exports = {
  mapper,
}
