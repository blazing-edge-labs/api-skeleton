const _ = require('lodash')
const joi = require('joi')
const jwt = require('jsonwebtoken')
const router = new (require('koa-router'))()

const auth = require('middleware/auth')
const consts = require('const')
const passwordTokenRepo = require('repo/passwordToken')
const responder = require('middleware/responder')
const roleUser = require('middleware/roleUser')
const userRepo = require('repo/user')
const validate = require('middleware/validate')
const mailer = require('utils/mailer')

router.use(responder)

router.post('/register', validate('body', {
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
}), async function (ctx) {
  const {email, password} = ctx.v.body
  await userRepo.create(email, password)
  ctx.state.r = await userRepo.getByEmail(email)
})

router.post('/auth', validate('body', {
  email: joi.string().email().required(),
  password: joi.string().required(),
}), async function (ctx) {
  const {email, password} = ctx.v.body
  const user = await userRepo.getByEmailPassword(email, password)
  const token = jwt.sign({id: user.id}, process.env.JWT_SECRET)
  ctx.state.r = {token}
})

router.get('/self', auth, async function (ctx) {
  const {id} = ctx.state.user
  ctx.state.r = await userRepo.getById(id)
})

router.put('/self', auth, validate('body', {
  // add
}), async function (ctx) {
  // const {id} = ctx.state.user
  throw new Error('not implemented')
})

router.put('/self/email', auth, validate('body', {
  email: joi.string().email().required(),
  password: joi.string().required(),
}), async function (ctx) {
  const {id} = ctx.state.user
  const {email, password} = ctx.v.body
  await userRepo.checkPassword(id, password)
  ctx.state.r = await userRepo.updateEmail(id, email)
})

router.put('/self/password', auth, validate('body', {
  oldPassword: joi.string().required(),
  newPassword: joi.string().min(8).required(),
}), async function (ctx) {
  const {id} = ctx.state.user
  const {oldPassword, newPassword} = ctx.v.body
  await userRepo.checkPassword(id, oldPassword)
  await userRepo.updatePassword(id, newPassword)
  ctx.state.r = {}
})

router.get('/self/role', auth, async function (ctx) {
  const {id} = ctx.state.user
  const user = await userRepo.getRoleById(id)
  ctx.state.r = {
    user,
    admin: user >= consts.roleUser.admin,
  }
})

router.get('/user/:id', auth, roleUser.gte(consts.roleUser.admin), validate('param', {
  id: joi.number().integer().positive().required(),
}), async function (ctx) {
  const {id} = ctx.v.param
  ctx.state.r = await userRepo.getById(id)
})

router.get('/user/email/:email', auth, roleUser.gte(consts.roleUser.admin), validate('param', {
  email: joi.string().email().required(),
}), async function (ctx) {
  const {email} = ctx.v.param
  ctx.state.r = await userRepo.getByEmail(email)
})

router.put('/user/:id/role', auth, roleUser.gte(consts.roleUser.admin), validate('param', {
  id: joi.number().integer().positive().required(),
}), validate('body', {
  role: joi.any().valid(_.values(consts.roleUser)).required(),
}), roleUser.gte('v.body.role'), async function (ctx) {
  const {id} = ctx.v.param
  const {role} = ctx.v.body
  await userRepo.setRoleById(id, role)
  ctx.state.r = {}
})

router.post('/recoverPassword', validate('body', {
  email: joi.string().email().required(),
}), async function (ctx) {
  // TODO throttle
  const {email} = ctx.v.body
  const token = await passwordTokenRepo.createByEmail(email)
  await mailer.forgotPassword(email, token)
  ctx.state.r = {}
})

router.post('/changePassword', validate('body', {
  password: joi.string().min(8).required(),
  token: joi.string().length(32).required(),
}), async function (ctx) {
  const {password, token} = ctx.v.body
  const id = await passwordTokenRepo.get(token)
  await userRepo.updatePassword(id, password)
  await passwordTokenRepo.remove(id)
  ctx.state.r = {}
})

module.exports = router
