const _ = require('lodash')
const joiToSwagger = require('joi-to-swagger')

const errorDocsLib = require('docs/api/lib/error')
const extendedDocs = require('docs/api/lib/extended')

// unique keys for doc validation properties
const propSymbols = {
  auth: Symbol('auth'),
  error: Symbol('error'),
  validation: Symbol('validation'),
}

/**
 * Get methods for swagger routes
 */
const documentedMethods = ['GET', 'PUT', 'PATCH', 'DELETE', 'POST']
const getMethod = methods => _.find(methods, method => _.includes(documentedMethods, method))

/**
 * Format parameters in query, params, body, header for docs
 */
function validateSection (objSchema, section) {
  if (_.isEmpty(objSchema)) {
    return []
  }

  const { swagger } = joiToSwagger(objSchema)
  const requiredNamesSet = new Set(swagger.required)

  return _.map(swagger.properties, ({ description, ...schema }, name) => ({
    description,
    in: section,
    name,
    required: requiredNamesSet.has(name),
    schema,
  }))
}

/**
 * Get swagger validation objects for query, params, body, header
 */
function getValidationSections (routeStack) {
  const routeValidations = {}
  const routeAuths = []

  for (const middleware of routeStack) {
    if (middleware[propSymbols.auth]) {
      routeAuths.push(middleware[propSymbols.auth])
    }
    if (middleware[propSymbols.validation]) {
      _.assign(routeValidations, middleware[propSymbols.validation])
    }

    if (middleware[propSymbols.error]) {
      _.assign(routeValidations, { errorConstants: middleware[propSymbols.error] })
    }
  }

  let bodySchema
  if (routeValidations.body) {
    bodySchema = _.get(joiToSwagger(routeValidations.body), 'swagger')
  }

  const parameters = [
    ...validateSection(routeValidations.param, 'path'),
    ...validateSection(routeValidations.query, 'query'),
    ...validateSection(routeValidations.header, 'header'),
  ]
  const definedValidationSections = {
    header: !!routeValidations.header,
    query: !!routeValidations.query,
    body: !!routeValidations.body,
    param: !!routeValidations.param,
  }

  const errorResponses = errorDocsLib.getErrorResponses(
    routeValidations.errorConstants,
    definedValidationSections,
  )

  return {
    auth: routeValidations.auth,
    parameters,
    bodySchema,
    errorResponses,
  }
}

function generateDocsFromRoute (route) {
  const method = _.toLower(getMethod(route.methods))
  const routeDoc = {
    summary: route.path,
  }
  const { auth, parameters, bodySchema, errorResponses } = getValidationSections(route.stack)

  if (_.size(auth)) {
    routeDoc.security = [{
      jwt: [],
    }]
  }

  routeDoc.parameters = parameters

  // body validation
  if (bodySchema) {
    routeDoc.requestBody = {
      content: {
        'application/json': {
          schema: bodySchema,
        },
      },
    }
  }

  // error responses
  if (!_.isEmpty(errorResponses)) {
    routeDoc.responses = errorResponses
  }

  return {
    [method]: routeDoc,
  }
}

/**
 * @param {array} routers - all routers in the application
 */
function generateDocsFromRoutes (routers) {
  const routes = _(routers.stack)
  .filter(route => !_.isEmpty(route.methods))
  .value()

  const routeDocs = {}

  _.each(routes, route => {
    const existingPathDocs = routeDocs[route.path] || {}
    routeDocs[route.path] = {
      ...existingPathDocs,
      ...generateDocsFromRoute(route),
    }
  })

  return routeDocs
}

module.exports = {
  ...extendedDocs,
  generateDocsFromRoutes,
  propSymbols,
}
