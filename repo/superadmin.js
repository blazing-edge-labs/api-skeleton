const error = require('error')
const { db, helper } = require('db')
const userRepo = require('repo/user')

// [ ] Todo: implement list filtering

/**
 * To export controllers (and add routes) for additional resources
 * simply add the resource name along with it's mappings below.
 *
 * If you need to use a less generic controller
 * you can manually override it at the bottom of this file
 */
const resourceMaps = {
  user: {
    map: userRepo.map,
    columnSet: userRepo.columnSet,
  },
  // add here
}
const resourceList = Object.keys(resourceMaps)

const getAll = (resource) => {
  const { map } = resourceMaps[resource]
  return async (query) => {
    const { sort, page, perPage } = query
    return db.sql`
      SELECT * FROM ~${resource}
      ORDER BY ^${sort.join(' ')}
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `
    .then(map)
  }
}

const getMany = (resource) => {
  const { map } = resourceMaps[resource]
  return async (ids) => {
    return db.sql`
      SELECT * FROM ~${resource}
      WHERE id IN (^${ids})
    `
    .then(map)
  }
}

const getAllCount = (resource) => {
  return async () => {
    return db.sql`SELECT count(*) AS total FROM ~${resource}`
  }
}

const getById = (resource) => {
  const { map } = resourceMaps[resource]
  return async (id) => {
    const [row] = await db.sql`
      SELECT *
      FROM ~${resource}
      WHERE id = ${id}
    `
    .then(map)

    if (!row) throw error(`${resource}.not_found`)
    return row
  }
}

const remove = (resource) => {
  return async (id) => {
    return db.sql`DELETE FROM ~${resource} WHERE id = ${id}`
  }
}

const create = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (data) => {
    const [row] = await db.sql`
      ^${helper.insert(data, columnSet)}
      RETURNING id
    `
    return row
  }
}

const update = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (id, data) => {
    const [row] = await db.sql`
      ^${helper.update(data, columnSet)}
      WHERE id = ${id}
      RETURNING id
    `
    return row
  }
}

// Export list of resources used
module.exports.resourceList = resourceList

// Generate & export all controllers for each resource
resourceList.forEach(resource => {
  module.exports[resource] = {
    getAll: getAll(resource),
    getMany: getMany(resource),
    getAllCount: getAllCount(resource),
    getById: getById(resource),
    remove: remove(resource),
    create: create(resource),
    update: update(resource),
  }
})

// Override generic controllers
module.exports.user.create = ({ email, password }) => userRepo.create(email, password)
