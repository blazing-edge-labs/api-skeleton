const { isArray } = Array

const escapeDoubleQuotes = str => str.replace(/"/g, '""')

const formatNames = xs => `"${xs.map(escapeDoubleQuotes).join('","')}"`
const formatValueWith = toValue => x => x instanceof Sql ? x._compile(toValue) : toValue(x)

class Sql {
  constructor (compile) {
    this._compile = compile
  }

  toPgQuery () {
    const values = []
    const text = this._compile(val => `$${values.push(val)}`)
    return { text, values }
  }

  toJSON () {
    throw new Error('Not allowed to stringify an Sql')
  }
}

const sql = ({ raw }, ...params) => new Sql(toValue => {
  let text = raw[0]

  for (let i = 0; i < params.length;) {
    const param = params[i]

    if (param instanceof Sql) {
      text += param._compile(toValue)
    } else if (raw[i].endsWith('"') && raw[i + 1].startsWith('"')) {
      text += isArray(param)
        ? param.map(escapeDoubleQuotes).join('","')
        : escapeDoubleQuotes(param)
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
  const code = '"' + names.map(escapeDoubleQuotes).join(`"${sep}"`) + '"'
  return new Sql(() => code)
}

sql.values = (values, sep = ',') => new Sql(toValue => Array.from(values, toValue).join(sep))

sql.cond = obj => new Sql(toValue => {
  return Object.keys(obj)
  .map(key => {
    const x = obj[key]
    return x instanceof Sql
      ? `("${escapeDoubleQuotes(key)}" ${x._compile(toValue)})`
      : `"${escapeDoubleQuotes(key)}" = ${toValue(x)}`
  })
  .join(' AND ')
})

sql.sets = obj => new Sql(toValue => {
  const leftSide = formatNames(Object.keys(obj))
  const rightSide = Object.values(obj).map(formatValueWith(toValue)).join(',')
  return `(${leftSide}) = (${rightSide})`
})

sql.update = ({
  table, // string
  where, // Sql | object
  set, // object
  skipEqual = false,
  returning = undefined, // '*' | string[] | undefined
}) => new Sql(toValue => {
  const conditionSql = where instanceof Sql ? where : sql.cond(where)
  const condition = conditionSql._compile(toValue)

  // const names = Object.keys(set).map(toName)
  const leftSide = formatNames(Object.keys(set))
  const rightSide = Object.values(set).map(formatValueWith(toValue)).join(',')

  let text = `UPDATE "${escapeDoubleQuotes(table)}"\n`
  text += `SET (${leftSide}) = (${rightSide})\n`
  text += `WHERE (${condition})\n`

  if (skipEqual) {
    text += `  AND (${leftSide}) IS DISTINCT FROM (${rightSide})`
  }

  if (returning) {
    text += 'RETURNING '
    text += returning === '*' ? '*' : formatNames(returning)
    text += '\n'
  }

  return text
})

sql.insert = ({
  into, // string
  columns = undefined, // string[] | undefined
  data, // object | object[]
  onConflict = undefined, // string | string[] | undefined
  update = undefined, // boolean | string[] | undefined
  skipEqual = false, // boolean
  returning = undefined, // '*' | string[] | undefined
}) => new Sql(toValue => {
  if (isArray(data)) {
    if (!columns) throw new TypeError('`columns` required when `data` is an array')
    if (data.length === 0) throw new TypeError('inserting data is empty')
  }

  const unquotedTable = escapeDoubleQuotes(into)
  let valuesBody

  if (columns) {
    const toCSV = obj => columns.map(k => toValue(obj[k])).join(',')
    valuesBody = isArray(data) ? data.map(toCSV).join('),\n(') : toCSV(data)
  } else {
    columns = Object.keys(data)
    valuesBody = Object.values(data).map(toValue).join(',')
  }

  let text = `INSERT INTO "${unquotedTable}" __t (${formatNames(columns)}) VALUES\n(${valuesBody})\n`

  if (onConflict != null) {
    const conflictIdentifiers = isArray(onConflict) ? onConflict : [onConflict]

    text += `ON CONFLICT (${formatNames(conflictIdentifiers)}) DO ${update ? 'UPDATE' : 'NOTHING'}\n`

    if (update) {
      if (!isArray(update)) {
        if (update !== true) throw new TypeError('invalid `update` option')
        update = columns.filter(col => !conflictIdentifiers.includes(col))
      }

      const unquotedNames = update.map(escapeDoubleQuotes)

      const excluded = 'Excluded."' + unquotedNames.join('",Excluded."') + '"'

      text += `SET ("${unquotedNames.join('","')}") = (${excluded})\n`

      if (skipEqual) {
        text += `WHERE (__t."${unquotedNames.join('",__t."')}") IS DISTINCT FROM (${excluded})\n`
      }
    } else if (update == null) {
      throw new TypeError('`onConflict` option requires `update`')
    }
  } else {
    if (update != null) throw new TypeError('`update` option requires `onConflict`')
    if (skipEqual) throw new TypeError('`skipEqual` option requires `onConflict`')
  }

  if (returning) {
    text += 'RETURNING '
    text += returning === '*' ? '*' : formatNames(returning)
    text += '\n'
  }

  return text
})

module.exports = {
  sql,
  Sql,
}
