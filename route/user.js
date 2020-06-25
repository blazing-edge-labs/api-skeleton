const _ = require('lodash')
const joi = require('@hapi/joi')
const jwt = require('jsonwebtoken')
const router = new (require('koa-router'))()

const auth = require('middleware/auth')
const error = require('error')
const konst = require('konst')
const mailer = require('mail')
const passwordTokenRepo = require('repo/passwordToken')
const roleUser = require('middleware/roleUser')
const userRepo = require('repo/user')
const validate = require('middleware/validate')

// signup & passwordless login
router.post('/signin',
  validate.body({
    email: joi.string().email().required(),
    originInfo: joi.string().trim().allow('').max(555).optional(),
    allowNew: joi.boolean().default(false),
    minRole: joi.any().valid(..._.values(konst.roleUser)).optional(),
  }),
  async function (ctx) {
    const { email, originInfo, allowNew, minRole } = ctx.v.body

    const user = allowNew
      ? await userRepo.getByEmailSilent(email) || await userRepo.create(email)
      : await userRepo.getByEmail(email)

    if (minRole && await userRepo.getRoleById(user.id) < minRole) {
      throw new error.GenericError('role.insufficient', null, 401)
    }

    const mailToken = await passwordTokenRepo.createById(user.id)
    await mailer.passwordlessLink(mailToken, email, originInfo)
    ctx.body = {}
  },
)

router.post('/auth',
  validate.body({
    email: joi.string().email().required(),
    password: joi.string().required(),
    minRole: joi.any().valid(..._.values(konst.roleUser)).optional(),
  }),
  async function (ctx) {
    const { email, password, minRole } = ctx.v.body
    const user = await userRepo.getByEmailPassword(email, password)

    if (minRole && await userRepo.getRoleById(user.id) < minRole) {
      throw new error.GenericError('role.insufficient', null, 401)
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET)
    ctx.body = { token }
  },
)

router.post('/auth/token',
  validate.body({
    token: joi.string().guid().required(),
  }),
  async function (ctx) {
    const { token } = ctx.v.body
    const userId = await passwordTokenRepo.get(token)
    await passwordTokenRepo.remove(userId)
    const jwtToken = jwt.sign({ id: userId }, process.env.JWT_SECRET)
    ctx.body = { token: jwtToken }
  },
)

router.get('/self', auth,
  async function (ctx) {
    const { id } = ctx.state.user
    ctx.body = await userRepo.getById(id)
  },
)

router.put('/self', auth,
  validate.body({
  // add
  }),
  async function (ctx) {
  // const {id} = ctx.state.user
    throw new Error('not implemented')
  },
)

router.put('/self/email', auth,
  validate.body({
    email: joi.string().email().required(),
    password: joi.string().optional(),
  }),
  async function (ctx) {
    const { id } = ctx.state.user
    const { email, password } = ctx.v.body
    await userRepo.checkPassword(id, password)
    ctx.body = await userRepo.updateEmail(id, email)
  },
)

router.put('/self/password', auth,
  validate.body({
    oldPassword: joi.string().optional(),
    newPassword: joi.string().min(8).required(),
  }),
  async function (ctx) {
    const { id } = ctx.state.user
    const { oldPassword, newPassword } = ctx.v.body
    await userRepo.checkPassword(id, oldPassword)
    await userRepo.updatePassword(id, newPassword)
    ctx.body = {}
  },
)

router.get('/self/role', auth,
  async function (ctx) {
    const { id } = ctx.state.user
    const user = await userRepo.getRoleById(id)
    ctx.body = {
      user,
      admin: user >= konst.roleUser.admin,
    }
  },
)

router.get('/user/:id', auth, roleUser.gte(konst.roleUser.admin),
  validate.param({
    id: joi.number().integer().positive().required(),
  }),
  async function (ctx) {
    const { id } = ctx.v.param
    ctx.body = await userRepo.getById(id)
  },
)

router.get('/user/email/:email', auth, roleUser.gte(konst.roleUser.admin),
  validate.param({
    email: joi.string().email().required(),
  }),
  async function (ctx) {
    const { email } = ctx.v.param
    ctx.body = await userRepo.getByEmail(email)
  },
)

router.put('/user/:id/role', auth, roleUser.gte(konst.roleUser.admin),
  validate.param({
    id: joi.number().integer().positive().required(),
  }),
  validate.body({
    role: joi.any().valid(..._.values(konst.roleUser)).required(),
  }),
  roleUser.gte('v.body.role'),
  async function (ctx) {
    const { id } = ctx.v.param
    const { role } = ctx.v.body
    await userRepo.setRoleById(id, role)
    ctx.body = {}
  },
)

router.post('/recoverPassword',
  validate.body({
    email: joi.string().email().required(),
  }),
  async function (ctx) {
  // TODO throttle
    const { email } = ctx.v.body
    const token = await passwordTokenRepo.createByEmail(email)
    await mailer.forgotPassword(email, token)
    ctx.body = {}
  },
)

router.post('/changePassword',
  validate.body({
    password: joi.string().min(8).required(),
    token: joi.string().guid().required(),
  }),
  async function (ctx) {
    const { password, token } = ctx.v.body
    const id = await passwordTokenRepo.get(token)
    await userRepo.updatePassword(id, password)
    await passwordTokenRepo.remove(id)
    ctx.body = {}
  },
)

module.exports = router
