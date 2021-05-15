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

const update = ({ onlyIfDistinct = false }) => (table, condition, data) => new Sql(toValue => {
  const conditionSql = condition instanceof Sql ? condition : sql.cond(condition)
  const conditionText = conditionSql._compile(toValue)
  const colNames = Object.keys(data).map(toName)
  const colValues = Object.values(data).map(toValue)

  let text = `
    UPDATE ${toName(table)}
    SET ${colNames.map((colName, i) => `${colName} = ${colValues[i]}`)}
    WHERE (${conditionText})
  `

  if (onlyIfDistinct) {
    const distinctCondition = colNames
    .map((colName, i) => `${colName} IS DISTINCT FROM ${colValues[i]}`)
    .join(' OR ')

    text += `AND (${distinctCondition})`
  }

  return text
})

sql.update = update({})
sql.updateIfDistinct = update({ onlyIfDistinct: true })

sql.insertOne = (table, data) => new Sql(toValue => `
  INSERT INTO "${toName(table)}"
  (${Object.keys(data).map(toName)})
  VALUES (${Object.values(data).map(toValue)})
`)

const upsert = ({ onConflictDo, onlyIfDistinct = false }) => (table, filter, data) => new Sql(toValue => {
  let text = sql.insertOne(table, { ...filter, ...data })._compile(toValue)

  text += `\nON CONFLICT (${Object.keys(filter).map(toName)}) DO ${onConflictDo}`

  if (onConflictDo === 'UPDATE') {
    const tableName = toName(table)
    const colNames = Object.keys(data).map(toName)

    text += `\nSET ${colNames.map(colName => `${colName} = Excluded.${colName}`)}`

    if (onlyIfDistinct) {
      const distinctCondition = colNames
      .map(colName => `${tableName}.${colName} IS DISTINCT FROM Excluded.${colName}`)
      .join(' OR ')

      text += `\nWHERE (${distinctCondition})`
    }
  }

  return text
})

sql.upsert = upsert({ onConflictDo: 'UPDATE' })
sql.upsertIfMissing = upsert({ onConflictDo: 'NOTHING' })
sql.upsertIfDistinct = upsert({ onConflictDo: 'UPDATE', onlyIfDistinct: true })

module.exports = {
  sql,
  Sql,
}
