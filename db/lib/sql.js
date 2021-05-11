const { toIdentifier: toName } = require('./format')

const { isArray } = Array

const toSource = (x, toValue) => {
  if (!x) return ''
  if (typeof x === 'function') return x(toValue)
  if (isArray(x)) return x.map(toValue).join()
  return String(x)
}

const reSplitMod = /([~^])?$/

const sql = ({ raw }, ...xs) => toValue => {
  let query = ''

  for (let i = 0; i < xs.length; ++i) {
    const [chunk, mod] = raw[i].split(reSplitMod)
    query += chunk

    if (!mod) {
      query += toValue(xs[i])
    } else if (mod === '~') {
      query += isArray(xs[i]) ? xs[i].map(toName).join() : toName(xs[i])
    } else if (mod === '^') {
      query += toSource(xs[i], toValue)
    }
  }

  query += raw[raw.length - 1]

  return query
}

module.exports = {
  sql,
}
