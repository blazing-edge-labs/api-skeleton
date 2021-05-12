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

sql.update = (table, condition, update, onlyIfDistinct = false) => toValue => {
  const pairs = Object.entries(update).map(pair => [toName(pair[0]), toValue(pair[1])])
  const cond = toSource(condition, toValue)

  return `
    UPDATE ${toName(table)}
    SET ${pairs.map(it => it.join(' = ')).join(', ')}
    WHERE (${cond})
    ${onlyIfDistinct ? 'AND (' + pairs.map(it => it.join(' IS DISTINCT FROM ')).join(' OR ') + ')' : ''}
  `
}

sql.insertOne = (table, data) => sql`
  INSERT INTO ~${table}
  (~${Object.keys(data)})
  VALUES (^${Object.values(data)})
`

module.exports = {
  sql,
}
