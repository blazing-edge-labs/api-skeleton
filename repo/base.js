const assert = require('assert')

const { byKeyed, byGrouped, memoRefIn, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { db: _db, Sql, format } = require('db')

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

const reWord = /^[a-zA-Z]\w*$/

const asCode = x => {
  if (!x) return ''
  if (x instanceof Sql) return x.toPlainQuery()
  if (reWord.test(x)) return format.toIdentifier(x)
  return String(x)
}

const asNamesOrCode = x => Array.isArray(x)
  ? x.map(format.toIdentifier).join(',')
  : asCode(x)

const sqlLoaderBuilder = ({ multi }) => ({
  select = '*',
  from,
  by = '',
  where = '',
  orderBy = '',
  map = identity,
  ...rest
}) => {
  assert(from, '"from" is required')
  assert(!by === /\b__\b/.test(where), '"by", xor use of `__` in "where", is required')

  const simpleSel = reWord.test(by) && select === '*'
  const mapItem = map[kMapItem] || map
  const keyName = simpleSel ? by : '__'

  select = asNamesOrCode(select)
  by = asCode(by)
  from = asCode(from)
  orderBy = asNamesOrCode(orderBy)

  if (by && !simpleSel) {
    select += `, ${by} AS __`
  }

  if (!by && select !== '*' && select !== '__') {
    select += ', __'
  }

  return loader((db, locking) => async keys => {
    const text = by
      ? `
        SELECT ${select}
        FROM ${from}
        WHERE ${by} IN (${keys.map(format.toLiteral)})
        ${where && `AND (${where})`}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking}
      `
      : `
        SELECT ${select}
        FROM (VALUES (${keys.map(format.toLiteral).join('),(')})) __t (__), ${from}
        WHERE ${where}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking}
      `

    const r = await db.query({ text })

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
