const _ = require('lodash')

const { db, pgp } = require('db')
const error = require('error')

const { format, csv } = pgp.as

const CHUNK_SIZE = 250

function mapper (mapping) {
  const [ extras, nonExtras ] = _.partition(Object.entries(mapping), pair => _.isArray(pair[1]))

  const ownMapping = nonExtras.map(([name, fx]) => [name, fx, _.isFunction(fx)])

  function mapItem (item) {
    const res = {}

    // optimized for performance (this code is potentially run on large datasets)
    for (const [ name, fx, isFun ] of ownMapping) {
      const value = isFun ? fx(item) : item[fx]

      // ignore undefined values
      if (value !== void 0) {
        res[name] = value
      }
    }

    return res
  }

  function map (data) {
    if (!data) return null
    return _.isArray(data) ? data.map(mapItem) : mapItem(data)
  }

  map.loading = (includes, opts) => async data => {
    if (!data) return null

    const raw = _.castArray(data)
    const mapped = raw.map(mapItem)
    const getColumn = _.memoize(col => raw.map(r => r[col]))

    await Promise.all(extras.map(extra => {
      const [name, [keyCol, resolver]] = extra
      if (includes[name]) {
        return resolver(getColumn(keyCol), opts, includes[name])
        .then(values => values.forEach((val, i) => {
          mapped[i][name] = val
        }))
      }
    }))

    return _.isArray(data) ? mapped : mapped[0]
  }

  map.mapping = { ...mapping }
  return map
}

function createResolver (table, keyColumn, { map = _.identity, multi = false, condition = '' } = {}) {
  const leftPart = format('SELECT * FROM $1~ WHERE $2~ IN', [table, keyColumn])
  const rightPart = condition ? `AND ${condition}` : ''

  return async (keys, opts = {}, includes) => {
    if (keys.length === 0) return []

    const rows = await autoChunk(CHUNK_SIZE, keys, chunk => {
      return (opts.t || db).any(`${leftPart} (${csv(chunk)}) ${rightPart}`).catch(error.db)
    })

    const rowKeys = rows.map(row => row[keyColumn])

    const mapped = !includes
      ? map(rows)
      : await map.loading(includes, opts)(rows)

    return keys.map(byZipped(rowKeys, mapped, multi))
  }
}

function autoChunk (chunkSize, data, func) {
  if (data.length <= chunkSize) {
    return func(data)
  }

  const chunks = _.chunk(_.uniq(data), chunkSize)
  return Promise.all(chunks.map(func)).then(_.flatten)
}

function byZipped (keys, values, multi = false) {
  const map = new Map()

  if (multi) {
    const getArray = key => map.get(key) || map.set(key, []).get(key)

    keys.forEach((key, i) => {
      getArray(key).push(values[i])
    })

    return getArray
  }

  keys.forEach((key, i) => {
    map.set(key, values[i])
  })

  return key => map.get(key)
}

module.exports = {
  mapper,
  createResolver,
}
