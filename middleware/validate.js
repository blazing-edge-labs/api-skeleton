const _ = require('lodash')
const joi = require('joi')

const error = require('error')

const defaults = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
}

const paths = {
  body: 'request.body',
  header: 'request.header',
  param: 'params',
  query: 'request.query',
}

const validator = (path, target) => (schema, options = {}) => {
  const opts = _.defaults(options, defaults)
  const schemaCompiled = joi.compile(schema)

  return async function (ctx, next) {
    const input = _.get(ctx, path)

    const {error: err, value: data} = schemaCompiled.validate(input, opts)
    if (err) {
      err.target = target
      throw new error.ValidationError('http.bad_request', err, 400)
    }

    _.update(ctx, `v.${target}`, prevData => ({...prevData, ...data}))

    await next()
  }
}

module.exports = _.mapValues(paths, validator)
