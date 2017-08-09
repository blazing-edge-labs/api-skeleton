const _ = require('lodash')
const joi = require('joi')
const jwt = require('jsonwebtoken')
const router = new (require('koa-router'))()

const auth = require('middleware/auth')
const consts = require('const')
const passwordTokenRepo = require('repo/passwordToken')
const responder = require('middleware/responder')
const roleCenter = require('middleware/roleCenter')
const roleUser = require('middleware/roleUser')
const userRepo = require('repo/user')
const validate = require('middleware/validate')

router.use(responder)

router.post('/register', validate('body', {
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
  name: joi.string().trim().required(),
  zip: joi.string().trim().regex(/^[0-9]+$/).max(5).required(),
  phone: joi.string().trim().regex(/^[0-9]+$/).min(10).max(15).required(),
  photoPermission: joi.bool().optional().default(true),
  birthdate: joi.date().max('now').required(),
  veteran: joi.bool().optional().default(false),
  gender: joi.any().valid(_.values(consts.gender)).optional(),
  race: joi.array().items(joi.any().valid(_.values(consts.race)).optional()).unique().optional(),
}), async function (ctx) {
  const {email, password, name, zip, phone, photoPermission, birthdate, veteran, gender, race} = ctx.v.body
  await userRepo.create(email, password, name, zip, phone, photoPermission, birthdate, veteran, gender, race)
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
  name: joi.string().trim().optional(),
  zip: joi.string().trim().regex(/^[0-9]+$/).max(5).optional(),
  phone: joi.string().trim().regex(/^[0-9]+$/).min(10).max(15).optional(),
  photoPermission: joi.bool().optional(),
  birthdate: joi.date().max('now').optional(),
  veteran: joi.bool().optional(),
  gender: joi.any().valid(_.values(consts.gender)).optional(),
  race: joi.array().items(joi.any().valid(_.values(consts.race)).optional()).unique().optional(),
}), async function (ctx) {
  const {name, zip, phone, photoPermission, birthdate, veteran, gender, race} = ctx.v.body
  const {id} = ctx.state.user
  await userRepo.updateById(id, name, zip, phone, photoPermission, birthdate, veteran, gender, race)
  ctx.state.r = await userRepo.getById(id)
})

router.get('/self/role', auth, async function (ctx) {
  const {id} = ctx.state.user
  const role = await Promise.props({
    user: userRepo.getRoleById(id),
    center: userRepo.getCenterRolesById(id),
  })
  ctx.state.r = {
    ...role,
    admin: role.user >= consts.roleUser.admin || _.some(role.center, centerRole => centerRole.role >= consts.roleCenter.instructor),
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
}), roleUser.p.gte('v.body.role'), async function (ctx) {
  const {id} = ctx.v.param
  const {role} = ctx.v.body
  await userRepo.setRoleById(id, role)
  ctx.state.r = {}
})

router.put('/user/:id/rolecenter', auth, validate('param', {
  id: joi.number().integer().positive().required(),
}), validate('body', {
  centerId: joi.number().integer().positive().required(),
  role: joi.any().valid(_.values(consts.roleCenter)).required(),
}), roleCenter.gte(consts.roleCenter.instructor, 'v.body.centerId'), roleCenter.p.gte('v.body.role', 'v.body.centerId'), async function (ctx) {
  const {id} = ctx.v.param
  const {centerId, role} = ctx.v.body
  await userRepo.setCenterRoleByIdCenterId(id, centerId, role)
  ctx.state.r = {}
})

router.get('/user/center/:centerId/possibleinstructors', validate('param', {
  centerId: joi.number().integer().positive().required(),
}), async function (ctx) {
  const {centerId} = ctx.v.param
  ctx.state.r = await userRepo.getPossibleInstructorsByCenterId(centerId)
})

router.post('/passwordtoken', validate('body', {
  email: joi.string().email().required(),
}), async function (ctx) {
  // TODO throttle
  const {email} = ctx.v.body
  ctx.state.r = await passwordTokenRepo.createByEmail(email)
})

router.post('/passwordchange', validate('body', {
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
