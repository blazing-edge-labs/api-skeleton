const _ = require('lodash')
const joiToSwagger = require('joi-to-swagger')

const errorDocsLib = require('docs/api/lib/error')

/**
 * Get methods for swagger routes
 */
const documentedMethods = ['GET', 'PUT', 'PATCH', 'DELETE', 'POST']
const getMethod = methods => _.find(methods, method => _.includes(documentedMethods, method))

/**
 * Format parameters in query, params, body, header for docs
 */
const getFormattedValidationParams = (docsInKey, requiredKeys) => (obj, key) => {
  const { description, ...schema } = obj
  const isRequired = _.includes(requiredKeys, key)

  return {
    description,
    in: docsInKey,
    name: key,
    required: isRequired,
    schema,
  }
}

function validateSection (objSchema, section) {
  if (_.isEmpty(objSchema)) {
    return []
  }

  const { swagger } = joiToSwagger(objSchema)
  return _.map(swagger.properties, getFormattedValidationParams(section, swagger.required))
}

/**
 * Get swagger validation objects for query, params, body, header
 */
function getValidationSections (routeStack) {
  const validationMiddleware = {
    auth: [],
  }

  _.each(routeStack, middleware => {
    if (middleware.name === '_validator') {
      middleware(validationMiddleware)
    }

    if (middleware.name === '_errorValidation') {
      middleware(validationMiddleware)
    }

    // TODO can be expanded for other auth
    if (middleware.name === 'jwt') {
      validationMiddleware.auth.push(middleware.name)
    }
  })

  let bodySchema
  if (validationMiddleware.body) {
    bodySchema = _.get(joiToSwagger(validationMiddleware.body), 'swagger')
  }

  const parameters = [
    ...validateSection(validationMiddleware.param, 'path'),
    ...validateSection(validationMiddleware.query, 'query'),
    ...validateSection(validationMiddleware.header, 'header'),
  ]
  const definedValidationSections = {
    header: !!validationMiddleware.header,
    query: !!validationMiddleware.query,
    body: !!validationMiddleware.body,
    param: !!validationMiddleware.param,
  }

  const errorResponses = errorDocsLib.getErrorResponses(
    validationMiddleware.errorConstantObjs,
    definedValidationSections,
  )

  return {
    auth: validationMiddleware.auth,
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
  const routes = _(routers)
  .map(({ router }) => router.stack)
  .flatten()
  .filter(route => _.size(route.methods))
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
  generateDocsFromRoutes,
}
