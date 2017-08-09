const _ = require('lodash')

const error = require('error')
const userRepo = require('repo/user')

const check = fn => roleOrPath => async (ctx, next) => {
  const role = _.isString(roleOrPath) ? _.get(ctx, roleOrPath) : roleOrPath
  if (!fn(await userRepo.getRoleById(ctx.state.user.id), role)) {
    throw new error.GenericError('role.insufficient', null, 401)
  }
  await next()
}

async function role (ctx, next) {
  _.set(ctx.state, 'role.user', await userRepo.getRoleById(ctx.state.user.id))
  await next()
}

role.eq = check(_.eq)
role.gt = check(_.gt)
role.gte = check(_.gte)

module.exports = role
