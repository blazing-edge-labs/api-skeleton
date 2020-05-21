function errorValidation (errorConstants = []) {
  return async function _errorValidation (ctx, next) {
    if (!next) {
      return ctx.errorConstants = errorConstants
    }

    try {
      await next()
    } catch (err) {
      console.error(err)
      throw err
    }
  }
}

module.exports = errorValidation