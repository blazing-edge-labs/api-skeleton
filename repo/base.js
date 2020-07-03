const assert = require('assert')

const { byKeyed, byGrouped, memoRef, identity } = require('utils/data')
const { createLoader } = require('utils/batch')
const { as } = require('db').pgp

const kMapItem = Symbol('mapItem')

function mapper (mapping) {
  const props = [
    ...Object.getOwnPropertyNames(mapping),
    ...Object.getOwnPropertySymbols(mapping),
  ]
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

function createLoaderT (batchResolverT, { batchMaxSize = 1000 } = {}) {
  assert(batchResolverT.length === 1, 'batchResolver creator must be a function with single argument')
  return memoRef(t => createLoader(batchResolverT(t), { batchMaxSize }))
}

const createSelectLoaderT = ({ multi }) => ({ from: table, by: keyColumn, where = '', map = identity }) => {
  const leftPart = as.format('SELECT * FROM $1~ WHERE $2~ IN', [table, keyColumn])
  const rightPart = where && `AND ${where}`
  const mapItem = map[kMapItem] || map

  return createLoaderT(t => async keys => {
    const r = await t.any(`${leftPart} (${as.csv(keys)}) ${rightPart}`)

    if (multi && keys.length === 1) {
      return [r.map(mapItem)]
    }

    return multi
      ? keys.map(byGrouped(r, it => it[keyColumn], mapItem))
      : keys.map(byKeyed(r, it => it[keyColumn], mapItem))
  })
}

createLoaderT.selectOne = createSelectLoaderT({ multi: false })
createLoaderT.selectAll = createSelectLoaderT({ multi: true })

module.exports = {
  mapper,
  createLoaderT,
}
