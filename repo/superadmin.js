const error = require('error')
const { db, sql } = require('db')
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
    prepare: userRepo.prepare,
  },
  // add here
}
const resourceList = Object.keys(resourceMaps)

const getAll = (resource) => {
  const { map } = resourceMaps[resource]
  return async (query) => {
    const { sort, page, perPage } = query
    return db.sql`
      SELECT * FROM "${resource}"
      ORDER BY ${sql.raw(sort.join(' '))}
      LIMIT ${perPage}
      OFFSET ${(page - 1) * perPage}
    `
    .then(map)
  }
}

const getMany = (resource) => {
  const { map } = resourceMaps[resource]
  return async (ids) => {
    return db.sql`
      SELECT * FROM "${resource}"
      WHERE id IN (${sql.values(ids)})
    `
    .then(map)
  }
}

const getAllCount = (resource) => {
  return async () => {
    return db.sql`SELECT count(*) AS total FROM "${resource}"`
  }
}

const getById = (resource) => {
  const { map } = resourceMaps[resource]
  return async (id) => {
    const [row] = await db.sql`
      SELECT *
      FROM "${resource}"
      WHERE id = ${id}
    `
    .then(map)

    if (!row) throw error(`${resource}.not_found`)
    return row
  }
}

const remove = (resource) => {
  return async (id) => {
    await db.sql`DELETE FROM "${resource}" WHERE id = ${id}`
  }
}

const create = (resource) => {
  const { prepare } = resourceMaps[resource]
  return async (data) => {
    const [item] = await db.insert({
      intoTable: resource,
      data: prepare(data),
      returning: ['id'],
    })

    return item
  }
}

const update = (resource) => {
  const { prepare, map } = resourceMaps[resource]
  return async (id, data) => {
    const [row] = await db.update({
      table: resource,
      where: { id },
      set: prepare(data),
      returning: '*',
    })

    return map(row)
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
