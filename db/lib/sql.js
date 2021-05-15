const { toIdentifier: toName, toLiteral } = require('./format')

const escapeQuotes = str => str.replace(/"/g, '""')

class Sql {
  constructor (compile) {
    this._compile = compile
  }

  get source () {
    return this._compile(toLiteral)
  }

  toPgQuery (name) {
    const values = []
    const text = this._compile(val => `$${values.push(val)}`)
    return { name, text, values }
  }
}

const sql = ({ raw }, ...params) => new Sql(toValue => {
  let text = raw[0]

  for (let i = 0; i < params.length;) {
    const param = params[0]

    if (param instanceof Sql) {
      text += param._compile(toValue)
    } else if (raw[i].endsWith('"') && raw[i + 1].startsWith('"')) {
      text += escapeQuotes(param)
    } else {
      text += toValue(param)
    }
    text += raw[++i]
  }

  return text
})

sql._ = new Sql(() => '')

sql.raw = source => {
  if (!source) return sql._
  if (source instanceof Sql) return source
  return new Sql(() => source)
}

sql.names = (names, sep = ',') => {
  const code = Array.from(names, toName).join(sep)
  return new Sql(() => code)
}

sql.values = (values, sep = ',') => new Sql(toValue => Array.from(values, toValue).join(sep))

sql.cond = obj => new Sql(toValue => {
  return Object.keys(obj)
  .map(key => {
    const x = obj[key]
    return `${toName(key)} = ${x instanceof Sql ? x._compile(toValue) : toValue(x)}`
  })
  .join(' AND ')
})

sql.update = (table, condition, update, onlyIfDistinct = false) => new Sql(toValue => {
  const pairs = Object.entries(update).map(pair => [toName(pair[0]), toValue(pair[1])])
  const condSql = condition instanceof Sql ? condition : sql.cond(condition)

  return `
    UPDATE ${toName(table)}
    SET ${pairs.map(it => it.join(' = ')).join(', ')}
    WHERE (${condSql._compile(toValue)})
    ${onlyIfDistinct ? 'AND (' + pairs.map(it => it.join(' IS DISTINCT FROM ')).join(' OR ') + ')' : ''}
  `
})

sql.insertOne = (table, data) => sql`
  INSERT INTO "${table}"
  (${sql.names(Object.keys(data))})
  VALUES (${sql.values(Object.values(data))})
`

module.exports = {
  sql,
}
