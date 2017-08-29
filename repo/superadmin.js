const error = require('error')
const {db} = require('db')
const userMap = require('repo/user').map

/**
 * To export controllers (and add routes) for additional resources
 * simply add the resource name along with it's mapping below
 */
const resourceMaps = {
  'user': userMap,
  // add here
}
const resourceList = Object.keys(resourceMaps)

// [ ] Todo: implement Create
// [ ] Todo: implement Update
// [ ] Todo: implement Delete

const getAll = (resource) => {
  const map = resourceMaps[resource]
  return async (query) => {
    const {sort, page, perPage} = query
    return db.any(`
  SELECT * FROM $1~
  ORDER BY $2^ $3^
  LIMIT $4 OFFSET $5
  `, [resource, ...sort, perPage, ((page - 1) * perPage)])
    .catch(error.QueryResultError, error(`${resource}.not_found`))
    .catch(error.db('db.read'))
    .then(results => results.map(map))
  }
}

const getAllCount = (resource) => {
  return async () => {
    return db.any('SELECT count(*) AS total FROM $1~', resource)
    .catch(error.db('db.read'))
  }
}

const getById = (resource) => {
  const map = resourceMaps[resource]
  return async (id) => {
    return db.one(`
    SELECT *
    FROM $1~
    WHERE id = $2
  `, [resource, id])
    .then(map)
    .catch(error.QueryResultError, error(`${resource}.not_found`))
    .catch(error.db('db.read'))
  }
}

resourceList.forEach(resource => {
  module.exports[resource] = {
    getAll: getAll(resource),
    getAllCount: getAllCount(resource),
    getById: getById(resource),
  }
})

module.exports.resourceList = resourceList
