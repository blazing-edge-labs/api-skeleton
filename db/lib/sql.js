const { toIdentifier: toName, toLiteral } = require('./format')
const { isArray } = require('lodash')

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
    return x instanceof Sql
      ? `(${toName(key)} ${x._compile(toValue)})`
      : `${toName(key)} = ${toValue(x)}`
  })
  .join(' AND ')
})

sql.sets = obj => new Sql(toValue => {
  return Object.keys(obj)
  .map(key => {
    const x = obj[key]
    return x instanceof Sql
      ? `(${toName(key)} = ${x._compile(toValue)})`
      : `${toName(key)} = ${toValue(x)}`
  })
  .join(', ')
})

sql.update = ({
  table, // string
  where, // Sql | object
  set, // object
  skipEqual = false,
  returning = undefined, // '*' | string[] | undefined
}) => new Sql(toValue => {
  const conditionSql = where instanceof Sql ? where : sql.cond(where)
  let condition = conditionSql._compile(toValue)

  const names = Object.keys(set).map(toName)
  const values = Object.values(set).map(toValue)

  if (skipEqual) {
    const isDistinct = names
    .map((name, i) => `${name} IS DISTINCT FROM ${values[i]}`)
    .join(' OR ')

    condition = `(${condition}) AND (${isDistinct})`
  }

  let text = `
    UPDATE ${toName(table)}
    SET ${names.map((name, i) => `${name} = ${values[i]}`)}
    WHERE ${condition}
  `

  if (returning) {
    const returnText = returning === '*' ? '*' : returning.map(toName)
    text += `\nRETURNING ${returnText}`
  }

  return text
})

sql.insert = ({
  intoTable, // string
  data, // object | object[]
  columns = undefined, // string[] | undefined
  onConflict = undefined, // string | string[] | undefined
  update = undefined, // boolean | string[] | undefined
  skipEqual = false, // boolean
  returning = undefined, // '*' | string[] | undefined
}) => new Sql(toValue => {
  if (!columns) {
    if (isArray(data)) throw new TypeError('`columns` required when `data` is an array')
    columns = Object.keys(data)
  }
  if (skipEqual && !update) {
    throw new TypeError('`skipEqual` allowed only with update')
  }

  const tableName = toName(intoTable)
  const colNames = columns.map(toName)

  let text = `INSERT INTO ${tableName} (${colNames}) VALUES\n(`

  if (isArray(data)) {
    // Inline literals for multiple records to avoid too many parameters
    const valuesFromObject = obj => columns.map(k => toLiteral(obj[k])).join(',')
    text += data.map(valuesFromObject).join('),\n(')
  } else {
    text += columns.map(k => toValue(data[k]))
  }

  text += ')'

  if (onConflict != null) {
    const conflictIdentifiers = isArray(onConflict) ? onConflict : [onConflict]
    const conflict = conflictIdentifiers.map(toName).join(',')

    text += `\nON CONFLICT (${conflict}) DO ${update ? 'UPDATE' : 'NOTHING'}`

    if (update) {
      if (!isArray(update)) {
        if (update !== true) throw new TypeError('invalid `update` option')
        update = columns.filter(col => !conflictIdentifiers.includes(col))
      }

      const updateNames = update.map(toName)
      const updateSets = updateNames.map(colName => `${colName} = Excluded.${colName}`)

      text += `\nSET ${updateSets}`

      if (skipEqual) {
        const isDistinct = updateNames
        .map(colName => `${tableName}.${colName} IS DISTINCT FROM Excluded.${colName}`)
        .join(' OR ')

        text += `\nWHERE ${isDistinct}`
      }
    } else if (update == null) {
      throw new TypeError('`onConflict` option requires `update`')
    }
  } else if (update != null) {
    throw new TypeError('`update` option requires `onConflict`')
  }

  if (returning) {
    const returnText = returning === '*' ? '*' : returning.map(toName)
    text += `\nRETURNING ${returnText}`
  }

  return text
})

module.exports = {
  sql,
  Sql,
}
