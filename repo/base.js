const _ = require('lodash')
const assert = require('assert')

const { db, pgp } = require('db')
const error = require('error')

const { format, csv } = pgp.as

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

function createResolver (getter, keyColumn, { map = _.identity, multi = false, chunkSize = 250, condition = '' } = {}) {
  // getter as table name
  if (_.isString(getter)) {
    const leftPart = format('SELECT * FROM $1~ WHERE $2~ IN', [getter, keyColumn])
    const rightPart = condition ? `AND ${condition}` : ''
    getter = (keys, { t = db, all }) => t.any(`${leftPart} (${csv(keys)}) ${all ? '' : rightPart}`).catch(error.db)
  } else {
    assert(!condition, '"condition" option valid only with createResolver(tableName, ...)')
  }

  return async (keys, opts, includes = {}) => {
    if (keys.length === 0) return []

    opts = { ...opts, ...includes._ }

    // avoiding too large queries by chunking keys and making multiple smaller queries instead
    const rows = await autoChunk(chunkSize, keys, chunk => getter(chunk, opts))

    const mapped = _.isEmpty(includes)
      ? map(rows)
      : await map.loading(includes, opts)(rows)

    const keyed = createMap(multi)
    mapped.forEach((val, i) => {
      keyed.set(rows[i][keyColumn], val)
    })
    return keys.map(keyed.get)
  }
}

function autoChunk (chunkSize, data, func) {
  if (data.length <= chunkSize) {
    return func(data)
  }

  const chunks = _.chunk(_.uniq(data), chunkSize)
  return Promise.all(chunks.map(func)).then(_.flatten)
}

function createMap (multi = false) {
  const map = new Map()

  const get = multi
    ? key => map.get(key) || map.set(key, []).get(key)
    : key => map.get(key)

  const set = multi
    ? (key, val) => get(key).push(val)
    : (key, val) => map.set(key, val)

  return { get, set }
}

module.exports = {
  mapper,
  createResolver,
}
