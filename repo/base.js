const assert = require('assert')

const { byKeyed, byGrouped, memoRefIn, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { sql } = require('db')

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

const selectLoader = ({ multi }) => ({ from: table, by: keyColumn, where = '', map = identity }) => {
  const leftPart = sql`SELECT * FROM ${sql.I(table)} WHERE ${sql.I(keyColumn)} IN`
  const rightPart = sql.__raw__(where && `AND ${where}`)
  const mapItem = map[kMapItem] || map

  return loader(t => async keys => {
    const r = (keys.length === 1 && keys[0] === null)
      ? []
      : await t.any`${leftPart} (${sql.csv(keys)}) ${rightPart}`

    // Minor optimization for single key case
    if (keys.length === 1) {
      return multi
        ? [r.map(mapItem)]
        : [r.length ? mapItem(r[0]) : null]
    }

    return multi
      ? keys.map(byGrouped(r, keyColumn, mapItem))
      : keys.map(byKeyed(r, keyColumn, mapItem, null))
  })
}

loader.selectOne = selectLoader({ multi: false })
loader.selectAll = selectLoader({ multi: true })

module.exports = {
  mapper,
  loader,
}
