const { toLiteral: L, toIdentifier: I } = require('./format')

const reTrim = /^(\s*)(.*?)(\s*)$/s

class Sql {
  constructor (source) {
    this.source = String(source)
  }

  toJSON () {
    return {}
  }
}

const isSql = x => x instanceof Sql

const compact = s => {
  if (s[0] !== '\n') return s
  const [, left, str] = reTrim.exec(s)
  const i = left.lastIndexOf('\n')
  return str.split(left.slice(i)).join('\n')
}

function _sql ({ raw }, values) {
  let source = raw[0]

  for (let i = 0; i < values.length;) {
    const value = values[i]
    source += isSql(value) ? value.source : L(value)
    source += raw[++i]
  }

  // return compact(source)
  return source
}

const sql = (str, ...values) => new Sql(_sql(str, values))
sql.__raw__ = x => x instanceof Sql ? x : new Sql(x)
sql.csv = (xs, sep = ',') => new Sql(Array.from(xs, L).join(sep))
sql.L = x => new Sql(L(x))
sql.I = xs => new Sql(typeof xs === 'string' ? I(xs) : Array.from(xs, I).join(','))

const isEmpty = x => x === undefined || (isSql(x) && !x.source)

sql.optional = (str, ...values) => values.some(isEmpty) ? sql`` : new Sql(_sql(str, values))

module.exports = {
  Sql,
  sql,
  isSql,
  _sql,
  compact,
}
