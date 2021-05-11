const assert = require('assert')

const { byKeyed, byGrouped, memoRefIn, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { sql, isSql } = require('db')

const kMapItem = Symbol('mapItem')

function mapper (mapping) {
  const props = Reflect.ownKeys(mapping)
  .map(key => {
    const val = mapping[key]
    const isFn = typeof val === 'function'
    return { key, val, isFn }
  })

  function mapItem (src) {
    const dst = {}
    for (const { key, val, isFn } of props) {
      const y = isFn ? val(src) : src[val]
      if (y !== undefined) dst[key] = y
    }
    return dst
  }

  function map (data) {
    if (!data) return null
    return Array.isArray(data) ? data.map(mapItem) : mapItem(data)
  }

  map[kMapItem] = mapItem
  map.mapping = { ...mapping }
  return map
}

function loader (batchResolverWith, { batchMaxSize = 1000 } = {}) {
  assert(batchResolverWith.length === 1, 'batchResolver creator must be a function with single argument')
  return memoRefIn(new WeakMap(), t => createLoader(batchResolverWith(t), { batchMaxSize }))
}

loader.withLocking = (batchResolverWithLocking, loaderOptions) => {
  assert(batchResolverWithLocking.length === 1, 'batchResolverWithLocking creator must be a function with single argument')

  const loadWith = loader(batchResolverWithLocking(sql``), loaderOptions)

  loadWith.lockFor = memoRefIn(new Map(), lockType => loader(batchResolverWithLocking(sql.__raw__(`FOR ${lockType}`)), loaderOptions))

  return loadWith
}

const _loader = ({ multi }) => ({ from: table, by = '', where = sql.empty, orderBy = sql.empty, map = identity }) => {
  assert(typeof table === 'string')
  assert(typeof by === 'string')
  assert(isSql(where))
  assert(isSql(orderBy))
  assert(typeof map === 'function')

  if (!!by === /\b__\b/.test(where.source)) {
    assert(by, 'With no "by", you need to use "__" in "where"')
    assert(!by, 'You can not use both "by" and "__" in "where"')
  }

  const keyName = by || '__'
  const mapItem = map[kMapItem] || map

  return loader.withLocking(locking => db => async keys => {
    let r

    if (!by) {
      r = await db.sql`
        SELECT *
        FROM (VALUES (${sql.csv(keys, '),(')})) AS t (__), ${sql.I(table)}
        WHERE ${where}
        ${sql.optional`ORDER BY ${orderBy}`}
        ${locking}
      `
    } else if (keys.length === 1 && keys[0] === null) {
      r = []
    } else {
      r = await db.sql`
        SELECT * FROM ${sql.I(table)}
        WHERE ${sql.I(by)} IN (${sql.csv(keys)})
        ${sql.optional`AND (${where})`}
        ${sql.optional`ORDER BY ${orderBy}`}
        ${locking}
      `
    }

    // Minor optimization for single key case
    if (keys.length === 1) {
      return multi
        ? [r.map(mapItem)]
        : [r.length ? mapItem(r[0]) : null]
    }

    return multi
      ? keys.map(byGrouped(r, keyName, mapItem))
      : keys.map(byKeyed(r, keyName, mapItem, null))
  })
}

loader.one = _loader({ multi: false })
loader.all = _loader({ multi: true })

module.exports = {
  mapper,
  loader,
}
