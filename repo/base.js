const _ = require('lodash')

function mapper (mapping) {
  return function (item) {
    return _.transform(mapping, function (r, v, k) {
      if (_.isFunction(v)) {
        r[k] = v(item)
      } else if (_.isString(v)) {
        r[k] = item[v]
      } else {
        // omit
      }
    })
  }
}

module.exports = {
  mapper,
}
