const identity = x => x

const toFn = x => {
  if (x == null) {
    return identity
  }
  switch (typeof x) {
    case 'function':
      return x
    case 'string':
    case 'symbol':
      return z => z[x]
    default:
      throw new TypeError('invalid mapper type')
  }
}

function byKeyed (iterable, mapKey, mapValue, defValue) {
  mapKey = toFn(mapKey)
  mapValue = toFn(mapValue)

  const cache = new Map()

  for (const item of iterable) {
    cache.set(mapKey(item), mapValue(item))
  }

  return key => {
    const val = cache.get(key)
    return val === undefined ? defValue : val
  }
}

function byGrouped (iterable, mapKey, mapValue, defValue) {
  mapKey = toFn(mapKey)
  mapValue = toFn(mapValue)

  const cache = new Map()

  for (const item of iterable) {
    const key = mapKey(item)
    const value = mapValue(item)
    const group = cache.get(key)
    if (group) {
      group.push(value)
    } else {
      cache.set(key, [value])
    }
  }

  return key => cache.get(key) || defValue
}

function * mapIterable (iterable, fn) {
  let i = 0
  for (const x of iterable) {
    yield fn(x, i++)
  }
}

module.exports = {
  identity,
  byKeyed,
  byGrouped,
  mapIterable,
}
