const { toLiteral: L, toIdentifier: I } = require('./format')

const reTrim = /^(\s*)(.*?)(\s*)$/s

class Sql {
  constructor (source) {
    this.source = String(source)
  }

  toJSON () {
    return {}
  }

  async exec (client) {
    const { rows } = await client.query(this.source)
    return rows
  }
}

const isSql = x => x instanceof Sql

const compact = s => {
  if (s[0] !== '\n') return s
  const [, left, str] = reTrim.exec(s)
  const i = left.lastIndexOf('\n')
  return str.split(left.slice(i)).join('\n')
}

function sql ({ raw }, ...values) {
  let source = raw[0]

  for (let i = 0; i < values.length; ++i) {
    const value = values[i]
    source += isSql(value) ? value.source : L(value)
    source += raw[++i]
  }

  // return compact(source)
  return new Sql(source)
}

sql.__raw__ = x => x instanceof Sql ? x : new Sql(x)
sql.csv = (xs, sep = ',') => new Sql(Array.from(xs, L).join(sep))
sql.L = x => new Sql(L(x))
sql.I = xs => new Sql(typeof xs === 'string' ? I(xs) : Array.from(xs, I).join(','))

sql.empty = sql``

const isEmpty = x => x === undefined || (isSql(x) && !x.source)

sql.optional = (str, ...values) => values.every(isEmpty) ? sql.empty : sql(str, ...values)

module.exports = {
  Sql,
  sql,
  isSql,
  compact,
}
