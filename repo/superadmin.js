const error = require('error')
const { db, sql, helper } = require('db')
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
    return db.any`
      SELECT * FROM ${sql.I(resource)}
      ORDER BY ${sql.__raw__(sort.join(' '))}
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `
    .then(map)
  }
}

const getMany = (resource) => {
  const { map } = resourceMaps[resource]
  return async (ids) => {
    return db.any`
      SELECT * FROM ${sql.I(resource)}
      WHERE id IN (${sql.csv(ids)})
    `
    .then(map)
  }
}

const getAllCount = (resource) => {
  return async () => {
    return db.any`SELECT count(*) AS total FROM ${sql.I(resource)}`
  }
}

const getById = (resource) => {
  const { map } = resourceMaps[resource]
  return async (id) => {
    return db.one`
      SELECT *
      FROM ${sql.I(resource)}
      WHERE id = ${id}
    `
    .catch(error.db({ noData: `${resource}.not_found` }))
    .then(map)
  }
}

const remove = (resource) => {
  return async (id) => {
    return db.any`DELETE FROM ${sql.I(resource)} WHERE id = ${id}`
  }
}

const create = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (data) => {
    return db.one`
      ${sql.__raw__(helper.insert(data, columnSet))}
      RETURNING id
    `
  }
}

const update = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (id, data) => {
    return db.one`
      ${sql.__raw__(helper.update(data, columnSet))}
      WHERE id = ${id}
      RETURNING id
    `
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
