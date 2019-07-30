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
    return db.any(`
      SELECT * FROM $1~
      ORDER BY $2^ $3^
      LIMIT $4 OFFSET $5
  `, [resource, ...sort, perPage, ((page - 1) * perPage)])
    .catch(error.db({ noData: `${resource}.not_found` }))
    .then(map)
  }
}

const getMany = (resource) => {
  const { map } = resourceMaps[resource]
  return async (ids) => {
    return db.any(`
      SELECT * FROM $1~
      WHERE id IN ($2:csv)
    `, [resource, ids])
    .catch(error.db({ noData: `${resource}.not_found` }))
    .then(map)
  }
}

const getAllCount = (resource) => {
  return async () => {
    return db.any('SELECT count(*) AS total FROM $1~', resource)
    .catch(error.db)
  }
}

const getById = (resource) => {
  const { map } = resourceMaps[resource]
  return async (id) => {
    return db.one(`
      SELECT *
      FROM $1~
      WHERE id = $2
    `, [resource, id])
    .catch(error.db({ noData: `${resource}.not_found` }))
    .then(map)
  }
}

const remove = (resource) => {
  return async (id) => {
    return db.none('DELETE FROM $1~ WHERE id = $2', [resource, id])
    .catch(error.db)
  }
}

const create = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (data) => {
    return db.one(helper.insert(data, columnSet) + ' RETURNING id')
    .catch(error.db)
  }
}

const update = (resource) => {
  const { columnSet } = resourceMaps[resource]
  return async (id, data) => {
    return db.one(helper.update(data, columnSet) + ' WHERE id = $1 RETURNING id', id)
    .catch(error.db)
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
