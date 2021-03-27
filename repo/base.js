const { byKeyed, byGrouped, memoArgs, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { as } = require('db').pgp

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

function loader (resolveBatchWith, { batchMaxSize = 1000 } = {}) {
  return memoArgs((...args) => createLoader(resolveBatchWith(...args), { batchMaxSize }))
}

const asIdentifier = x => as.csv([x])

const kForUpdate = Symbol('FOR UPDATE')

const _loader = ({ multi }) => ({ from, by, where = '', orderBy = '', map = identity }) => {
  const useJoin = /\b_key\b/.test(by)
  const keyName = useJoin ? '_key' : by
  const table = as.name(from)
  const keyColumn = as.name(keyName)
  const mapItem = map[kMapItem] || map

  return loader((t, mod) => async keys => {
    const forUpdate = mod && mod[kForUpdate]

    let r

    if (useJoin) {
      r = await t.any(`
        SELECT *
        FROM (VALUES (${keys.map(asIdentifier).join('),(')})) AS t (${keyColumn})
        JOIN ${table} ON (${by})
        ${where && `WHERE ${where}`}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${forUpdate ? 'FOR UPDATE' : ''}
      `)
    } else if (keys.length === 1 && keys[0] === null) {
      r = []
    } else {
      r = await t.any(`
        SELECT * FROM ${table}
        WHERE ${keyColumn} IN (${as.csv(keys)})
        ${where && `AND (${where})`}
        ${orderBy && `ORDER BY ${orderBy}`}
        ${forUpdate ? 'FOR UPDATE' : ''}
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
  })
}

loader.FOR_UPDATE = { [kForUpdate]: true }
loader.one = _loader({ multi: false })
loader.all = _loader({ multi: true })

module.exports = {
  mapper,
  loader,
}
