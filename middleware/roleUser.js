const _ = require('lodash')

const error = require('error')
const userRepo = require('repo/user')

function check (fn, role) {
  return async function (ctx, next) {
    if (!fn(await userRepo.getRoleById(ctx.state.user.id), role)) {
      throw new error.GenericError('role.insufficient', null, 401)
    }
    await next()
  }
}

function checkByPath (fn, path) {
  return async function (ctx, next) {
    const role = _.get(ctx, path)
    if (!fn(await userRepo.getRoleById(ctx.state.user.id), role)) {
      throw new error.GenericError('role.insufficient', null, 401)
    }
    await next()
  }
}

async function role (ctx, next) {
  _.set(ctx.state, 'role.user', await userRepo.getRoleById(ctx.state.user.id))
  await next()
}

role.eq = _.partial(check, _.eq)
role.gt = _.partial(check, _.gt)
role.gte = _.partial(check, _.gte)
role.p = {}
role.p.eq = _.partial(checkByPath, _.eq)
role.p.gt = _.partial(checkByPath, _.gt)
role.p.gte = _.partial(checkByPath, _.gte)

module.exports = role
