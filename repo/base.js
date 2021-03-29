const assert = require('assert')

const { byKeyed, byGrouped, memoRefIn, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { as } = require('db').pgp
const { db: _db } = require('db')

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

function loader (resolveKeysWith, { defaultDb = _db, batchMaxSize = 1000, ...notAllowed } = {}) {
  assert(resolveKeysWith.length === 1, 'resolveKeysWith must be a function with single argument')
  assert.deepEqual(notAllowed, {}, 'Invalid options')

  const loadUsing = memoRefIn(new WeakMap(), db => createLoader(resolveKeysWith(db), { batchMaxSize }))
  const load = loadUsing(defaultDb)
  load.using = loadUsing
  return load
}

loader.withLocking = (batchResolverWithLocking, loaderOptions) => {
  assert(batchResolverWithLocking.length === 1, 'batchResolverWithLocking creator must be a function with single argument')

  const load = loader(batchResolverWithLocking(''), loaderOptions)

  load.for = memoRefIn(new Map(), lockType => loader(batchResolverWithLocking(`FOR ${lockType}`), loaderOptions))

  return load
}

const asValue = x => as.csv([x])

const _loader = ({ multi }) => ({ from, by = '', where = '', orderBy = '', map = identity, ...rest }) => {
  const keyName = by || '__'
  const table = as.name(from)
  const keyColumn = as.name(keyName)
  const mapItem = map[kMapItem] || map

  if (!!by === /\b__\b/.test(where)) {
    assert(by, 'With no "by", you need to use "__" in "where"')
    assert(!by, 'You can not use both "by" and "__" in "where"')
  }

  return loader.withLocking(locking => db => async keys => {
    let r

    if (!by) {
      r = await db.any(`
        SELECT *
        FROM (VALUES (${keys.map(asValue).join('),(')})) AS t (__), ${table}
        WHERE ${where}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking}
      `)
    } else if (keys.length === 1 && keys[0] === null) {
      r = []
    } else {
      r = await db.any(`
        SELECT * FROM ${table}
        WHERE ${keyColumn} IN (${as.csv(keys)})
        ${where && `AND (${where})`}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking}
      `)
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
  }, rest)
}

loader.one = _loader({ multi: false })
loader.all = _loader({ multi: true })

module.exports = {
  mapper,
  loader,
}
