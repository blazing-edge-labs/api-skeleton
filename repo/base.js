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

function loader (resolveKeysWith, { db = _db, mapKey, batchMaxSize = 1000, ...notAllowed } = {}) {
  assert.deepEqual(notAllowed, {}, 'Invalid options')

  const loaderWith = memoRefIn(new Map(), locking => {
    if (locking) {
      assert(resolveKeysWith.length >= 2, 'Loader not supporting locking')
      assert(locking.startsWith('FOR '), 'Locking Clause expected to start with "FOR "')
    }
    const options = { mapKey, batchMaxSize }
    return memoRefIn(new WeakMap(), db => createLoader(resolveKeysWith(db, locking), options))
  })

  const loaderWithNoLocking = loaderWith('')
  const load = loaderWithNoLocking(db)

  load.using = (db, locking) => locking
    ? loaderWith(locking)(db)
    : loaderWithNoLocking(db)

  return load
}

const asValue = x => as.csv([x])

const sqlLoaderBuilder = ({ multi }) => ({
  select = '*',
  from,
  by = '',
  where = '',
  orderBy = '',
  map = identity,
  ...rest
}) => {
  assert(!by === /\b__\b/.test(where), '"by", xor use of `__` in "where", is required')

  if (/^\w+$/.test(from)) {
    from = as.name(from)
  }

  if (!by && select !== '*') {
    select = `__, ${select}`
  }

  const keyName = by || '__'
  const keyColumn = as.name(keyName)
  const mapItem = map[kMapItem] || map

  return loader((db, locking) => async keys => {
    let r

    if (!by) {
      r = await db.any(`
        SELECT ${select}
        FROM (VALUES (${keys.map(asValue).join('),(')})) AS __t (__), ${from}
        WHERE ${where}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking}
      `)
    } else if (keys.length === 1 && keys[0] === null) {
      r = []
    } else {
      r = await db.any(`
        SELECT ${select} FROM ${from}
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

loader.one = sqlLoaderBuilder({ multi: false })
loader.all = sqlLoaderBuilder({ multi: true })

module.exports = {
  mapper,
  loader,
}
