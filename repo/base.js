const { memoArgs } = require('memo-args')
const assert = require('assert')

const { byKeyed, byGrouped, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { as } = require('db').pgp
const { db } = require('db')

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

function loader (resolveKeysWith, { defaults = [], mapKey, batchMaxSize = 1000, ...notAllowed } = {}) {
  assert.deepEqual(notAllowed, {}, 'Invalid options')

  const maxArgs = Math.max(resolveKeysWith.length, defaults.length)

  const loadUsing = memoArgs((...args) => {
    assert(args.length <= maxArgs, 'loader not supporting that many arguments')

    const load = createLoader(resolveKeysWith(...args), { batchMaxSize })
    return !mapKey ? load : key => load(mapKey(key))
  })

  const load = loadUsing(...defaults)
  load.using = loadUsing
  return load
}

const asValue = x => as.csv([x])

const reWord = /^[a-zA-Z]\w*$/

const sqlLoaderBuilder = ({ multi }) => ({
  select = '*',
  from,
  by = '',
  where = '',
  orderBy = '',
  map = identity,
  defaultValue = null,
  mapKey = null,
  batchMaxSize = 1000,
  ...notAllowed
}) => {
  assert(from, '"from" is required')
  assert(!by === /\b__\b/.test(where), '"by", xor use of `__` in "where", is required')
  assert.deepEqual(notAllowed, {}, 'Invalid options')

  const mapItem = map[kMapItem] || map
  const simpleSel = reWord.test(by) && select === '*'
  const keyName = simpleSel ? by : '__'

  if (reWord.test(by)) by = as.name(by)
  if (reWord.test(from)) from = as.name(from)
  if (reWord.test(select)) select = as.name(select)
  if (reWord.test(orderBy)) orderBy = as.name(orderBy)

  if (by && !simpleSel) {
    select += `, ${by} AS __`
  }

  if (!by && select !== '*' && select !== '__') {
    select += ', __'
  }

  return loader((db, locking) => async keys => {
    let r

    if (locking) {
      assert(locking.startsWith('FOR '), 'Locking Clause expected to start with "FOR "')
    }

    if (!by) {
      r = await db.any(`
        SELECT ${select}
        FROM (VALUES (${keys.map(asValue).join('),(')})) __t (__), ${from}
        WHERE ${where}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking || ''}
      `)
    } else if (keys.length === 1 && keys[0] === null) {
      r = []
    } else {
      r = await db.any(`
        SELECT ${select}
        FROM ${from}
        WHERE ${by} IN (${as.csv(keys)})
        ${where && `AND (${where})`}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${locking || ''}
      `)
    }

    // Minor optimization for single key case
    if (keys.length === 1) {
      return multi
        ? [r.map(mapItem)]
        : [r.length ? mapItem(r[0]) : null]
    }

    return multi
      ? keys.map(byGrouped(r, keyName, mapItem, []))
      : keys.map(byKeyed(r, keyName, mapItem, defaultValue))
  }, {
    defaults: [db],
    batchMaxSize,
    mapKey,
  })
}

loader.one = sqlLoaderBuilder({ multi: false })
loader.all = sqlLoaderBuilder({ multi: true })

module.exports = {
  mapper,
  loader,
}
