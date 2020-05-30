const _ = require('lodash')

const error = require('error')

const getValidationErrorSchemaByKey = validationKey => ({
  type: 'object',
  properties: {
    error: {
      type: 'string',
    },
    code: {
      type: 'integer',
      description: 400,
    },
    errorv: {
      type: 'object',
      properties: {
        [validationKey]: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
              },
              path: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              type: 'string',
              context: {
                type: 'object',
                properties: {
                  child: {
                    type: 'string',
                  },
                  label: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                  key: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})

function formatErrorResponse (errorResponse) {
  // if there is no code then this is a validation error
  if (_.get(errorResponse, ['properties', 'code'])) {
    return errorResponse
  }

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
    },
  }
}

function formatErrorResponseByStatus (errorResponsesForStatus) {
  const formatedErrorResponse = _.map(errorResponsesForStatus, formatErrorResponse)

  const schema = _.size(formatedErrorResponse) > 1
    ? { oneOf: formatedErrorResponse }
    : formatedErrorResponse[0]

  return {
    content: {
      'application/json': {
        schema,
      },
    },
  }
}

/**
 * Group same status errors and format with toml errors objects
 */
function formatErrorsWithTomlErrors (errorConstantObjs) {
  const errorResponses = {}

  _.each(errorConstantObjs, errorConstantObj => {
    if (!errorResponses[errorConstantObj.status]) {
      errorResponses[errorConstantObj.status] = []
    }

    const [model, errorConstant] = errorConstantObj.error.split('.')

    if (model === '_validation') {
      errorResponses[errorConstantObj.status].push(getValidationErrorSchemaByKey(errorConstant))
      return
    }

    const code = _.get(error.errors, errorConstantObj.error)

    if (!code) {
      throw error('docs.missing_code', errorConstantObj.error)
    }

    errorResponses[errorConstantObj.status].push({
      error: errorConstantObj.error,
      code,
    })
  })

  return errorResponses
}

function getErrorResponses (errorConstantObjs = [], definedValidationSections = {}) {
  const _errorConstantObjs = [...errorConstantObjs]

  _.map(definedValidationSections, (isDefined, validationSection) => {
    if (!isDefined) {
      return
    }
    _errorConstantObjs.push({ status: 400, error: `_validation.${validationSection}` })
  })

  if (_.isEmpty(_errorConstantObjs)) {
    return {}
  }

  const docsResponses = {}
  const errorResponses = formatErrorsWithTomlErrors(_errorConstantObjs)

  _.each(errorResponses, (errorResponseArray, status) => {
    docsResponses[status] = formatErrorResponseByStatus(errorResponseArray)
  })

  return docsResponses
}

module.exports = {
  getErrorResponses,
}
