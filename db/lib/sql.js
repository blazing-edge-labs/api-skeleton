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

const compact = s => {
  if (s[0] !== '\n') return s
  const [, left, str] = reTrim.exec(s)
  const i = left.lastIndexOf('\n')
  return str.split(left.slice(i)).join('\n')
}

const toSource = x => x instanceof Sql ? x.source : L(x)

function _sql ({ raw }, values) {
  let source = raw[0]

  for (let i = 0; i < values.length;) {
    source += toSource(values[i])
    source += raw[++i]
  }

  // return compact(source)
  return source
}

const sql = (str, ...values) => new Sql(_sql(str, values))
sql.__raw__ = x => x instanceof Sql ? x : new Sql(x)
sql.csv = xs => new Sql(Array.from(xs, L).join(','))
sql.L = x => new Sql(L(x))
sql.I = xs => new Sql(typeof xs === 'string' ? I(xs) : Array.from(xs, I).join(','))

module.exports = {
  Sql,
  sql,
  _sql,
  compact,
}
