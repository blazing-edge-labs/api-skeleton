const error = require('error')
const {db, helper} = require('db')
const userRepo = require('repo/user')

// [ ] Todo: implement Create
// [ ] Todo: implement Update
// [x] Todo: implement Delete

/**
 * To export controllers (and add routes) for additional resources
 * simply add the resource name along with it's mappings below.
 *
 * If you need to use a less generic controller
 * you can manually override it at the bottom of this file
 */
const resourceMaps = {
  'user': {
    map: userRepo.map,
    cs: userRepo.cs,
  },
  // add here
}
const resourceList = Object.keys(resourceMaps)

const getAll = (resource) => {
  const {map} = resourceMaps[resource]
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
  const {map} = resourceMaps[resource]
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

const remove = (resource) => {
  return async (id) => {
    return db.none('DELETE FROM $1~ WHERE id = $2', [resource, id])
  }
}

const create = (resource) => {
  const {cs} = resourceMaps[resource]
  return async (data) => {
    return db.one(helper.insert(data, cs) + ' RETURNING id')
    .catch(error.db('db.write'))
  }
}

// const update = (resource) => {}

// Export list of resources used
module.exports.resourceList = resourceList

// Generate & export all controllers for each resource
resourceList.forEach(resource => {
  module.exports[resource] = {
    getAll: getAll(resource),
    getAllCount: getAllCount(resource),
    getById: getById(resource),
    remove: remove(resource),
    create: create(resource),
  }
})

// Override generic controllers
module.exports.user.create = ({email, password}) => userRepo.create(email, password)
