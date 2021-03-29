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

function loader (resolveKeysWith, { db = _db, batchMaxSize = 1000, ...notAllowed } = {}) {
  assert.deepEqual(notAllowed, {}, 'Invalid options')
  const canLock = resolveKeysWith.length === 2

  const loadWithNoLocking = memoRefIn(new WeakMap(), db => createLoader(resolveKeysWith(db, ''), { batchMaxSize }))

  const loadWith = memoRefIn(new Map(), locking => {
    assert(locking.startsWith('FOR '), 'Locking Clause expected to start with "FOR "')
    return memoRefIn(new WeakMap(), db => createLoader(resolveKeysWith(db, locking), { batchMaxSize }))
  })

  const load = loadWithNoLocking(db)

  load.using = (db, locking) => {
    if (locking) {
      assert(canLock, 'Loader not supporting locking')
      return loadWith(locking)(db)
    }
    return loadWithNoLocking(db)
  }

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

  return loader((db, locking) => async keys => {
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
