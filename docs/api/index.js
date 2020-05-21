const _ = require('lodash')
const fsPromises = require('fs').promises
const path = require('path')
const joiToSwagger = require('joi-to-swagger')

const error = require('error')

function formatErrorResponse (errorResponse) {
  return {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: errorResponse.error,
      },
      code: {
        type: 'integer',
        description: errorResponse.code,
      },
    }
  }
}

function formatErrorResponseByStatus (errorResponsesForStatus) {
  const formatedErrorResponse = _.map(errorResponsesForStatus, formatErrorResponse)

  const schema = _.size(formatedErrorResponse) > 1 ? {
    oneOf: formatedErrorResponse
  } : formatedErrorResponse[0]

  return {
    content: {
      'application/json': {
        schema
      }
    }
  }
}

/**
 * Group same status errors and format with toml errors objects
 */
function formatErrorsWithTomlErrors (errorConstants) {
  const errorResponses = {}

  _.each(errorConstants, errorConstant => {
    const errorObj = typeof errorConstant === 'object'
      ? errorConstant : { status: 400, error: errorConstant }

    if (!errorResponses[errorObj.status]) {
      errorResponses[errorObj.status] = []
    }

    const code = _.get(error.errors, errorObj.error)

    if (!code) {
      throw error('docs.missing_code', errorObj.error)
    }

    errorResponses[errorObj.status].push({
      error: errorObj.error,
      code,
    })
  })

  return errorResponses
}

function getErrorResponses (errorConstants) {
  if (!_.size(errorConstants)) {
    return []
  }

  const docsResponses = {}
  const errorResponses = formatErrorsWithTomlErrors(errorConstants)

  _.each(errorResponses, (errorResponseArray, status) => {
    docsResponses[status] = formatErrorResponseByStatus(errorResponseArray)
  })

  return docsResponses
}

/**
 * Get methods for swagger routes
 */
const documentedMethods = ['GET', 'PUT', 'PATCH', 'DELETE', 'POST']
const getMethod = methods => _.find(methods, method => _.includes(documentedMethods, method))

/**
 * Format parameters in query, params, body, header for docs
 */
const getFormattedValidationParams = (docsInKey, requiredKeys) => (obj, key) => {
  const {description, ...schema} = obj
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

  const {swagger} = joiToSwagger(objSchema)
  return _.map(swagger.properties, getFormattedValidationParams(section, swagger.required))
}

/**
 * Get swagger validation objects for query, params, body, header
 */
function getValidationSections (routeStack) {
  const validationMiddleware = {}
  _.each(routeStack, middleware => {
    if (middleware.name === '_validator') {
      middleware(validationMiddleware)
    }

    if (middleware.name === '_errorValidation') {
      middleware(validationMiddleware)
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

  const errorResponses = getErrorResponses(validationMiddleware.errorConstants)

  return { parameters, bodySchema, errorResponses }
}

function generateDocsFromRoute (route) {
  const method = _.toLower(getMethod(route.methods))
  const routeDoc = {
    summary: route.path,
  }
  const {parameters, bodySchema, errorResponses} = getValidationSections(route.stack)

  routeDoc.parameters = parameters

  // body validation
  if (bodySchema) {
    routeDoc.requestBody = {
      content: {
        'application/json': {
          schema: bodySchema
        }
      }
    }
  }

  if (_.size(errorResponses)) {
    routeDoc.responses = errorResponses
  }

  return {
    [method]: routeDoc
  }
}

/**
 * update the all routers array to add new routes to swagger docs
 */
const allRouters = [
  require('route/index').routes(),
  require('route/user').routes(),
  require('route/photos').routes(),
]

const allRoutes = _(allRouters)
  .map(({router}) => router.stack)
  .flatten()
  .filter(route => _.size(route.methods))
  .value()

/**
 * @param {array} routers - all routers in the application
 */
function generateDocsFromRoutes (routes) {
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
const base = {
  openapi: '3.0.0',
  servers: [
    {
      url: 'https://localhost:3000',
      description: 'Test server'
    },
  ],
  info: {
    version: process.env.npm_package_version,
    title: 'API Skeleton',
    description: 'This is the description'
  },
  paths: generateDocsFromRoutes(allRoutes)
}

/**
 * Bundle the docs into a JSON file for consumption
 */
async function createDocs () {
  return fsPromises.writeFile(
    path.join(__dirname, 'docs.json'),
    JSON.stringify(base)
  )
}

createDocs().catch(console.error)