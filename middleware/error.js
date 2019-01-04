const _ = require('lodash')

const error = require('error')

const httpCodeByStatus = _.invert(error.errors.http)

function wrap (err) {
  if (err instanceof error.GenericError) {
    return err
  }

  const httpCode = (err.status && httpCodeByStatus[err.status]) || 'internal'

  return error(`http.${httpCode}`, err)
}

function status (err) {
  return _.get(err, 'status', 500)
}

function format (err) {
  if (err instanceof error.ValidationError) {
    return {
      code: err.code,
      error: err.error,
      errorv: {
        [err.nested.target]: err.nested.details,
      },
    }
  }

  if (err instanceof error.GenericError) {
    return {
      code: err.code,
      error: err.error,
      errorv: process.env.NODE_ENV === 'development' ? err.nested : null,
    }
  }
}

function log (err) {
  if (process.env.LOG > 0 && err instanceof error.DatabaseError) {
    console.error(err.nested)
  } else if (process.env.LOG > 0 && err instanceof error.HttpError) {
    console.error(err.nested)
  } else if (err instanceof error.ValidationError) {
    // do nothing
  } else if (process.env.LOG > 1) {
    console.error(err.nested)
  }
}

module.exports = async function (ctx, next) {
  try {
    await next()
  } catch (e) {
    const err = wrap(e)
    log(err)
    ctx.status = status(err)
    ctx.body = format(err)
    ctx.app.emit('error', err, ctx)
  }
}
