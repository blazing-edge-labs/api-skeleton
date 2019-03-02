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
        return autoChunk(CHUNK_SIZE, resolver(opts, includes[name]), getColumn(keyCol))
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

  return (opts = {}, includes) => async keys => {
    if (keys.length === 0) return []

    const t = opts.t || db
    const rows = await t.any(`${leftPart} (${csv(keys)}) ${rightPart}`).catch(error.db)

    const mapped = _.isEmpty(includes)
      ? map(rows)
      : await map.loading(includes, opts)(rows)

    const rowKeys = rows.map(row => row[keyColumn])

    return keys.map(byZipped(rowKeys, mapped, multi))
  }
}

async function autoChunk (chunkSize, resolve, keys) {
  if (keys.length <= chunkSize) {
    return resolve(keys)
  }

  const uniqueKeys = [...new Set(keys)]

  const keyChunks = _.chunk(uniqueKeys, chunkSize)
  const valChunks = await Promise.all(keyChunks.map(resolve))

  return keys.map(byZipped(uniqueKeys, _.flatten(valChunks)))
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
