const _ = require('lodash')
const joi = require('joi')

const docsLib = require('docs/api/lib')
const error = require('error')

const defaults = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
}

function validator (path, target, schema, options = {}) {
  const opts = _.defaults(options, defaults)
  const schemaCompiled = joi.compile(schema)

  const _validator = async function (ctx, next) {
    const input = _.get(ctx, path)

    const { error: err, value: data } = schemaCompiled.validate(input, opts)
    if (err) {
      err.target = target
      throw new error.ValidationError('http.bad_request', err, 400)
    }

    _.update(ctx, `v.${target}`, prevData => ({ ...prevData, ...data }))

    await next()
  }

  _.set(_validator, [docsLib.propSymbols.validation, target], schema)

  return _validator
}

module.exports = {
  body: validator.bind(null, 'request.body', 'body'),
  header: validator.bind(null, 'request.header', 'header'),
  param: validator.bind(null, 'params', 'param'),
  query: validator.bind(null, 'request.query', 'query'),
}
