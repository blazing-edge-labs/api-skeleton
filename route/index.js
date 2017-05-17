const joi = require('joi')
const jwt = require('jsonwebtoken')
const router = new (require('koa-router'))()

const responder = require('middleware/responder')
const userRepo = require('repo/user')
const validate = require('middleware/validate')

router.use(responder)

router.post('/auth', validate('body', {
  email: joi.string().email().required(),
  password: joi.string().required(),
}), async function (ctx) {
  const {email, password} = ctx.request.vbody
  const user = await userRepo.getByEmailPassword(email, password)
  const token = jwt.sign({id: user.id}, process.env.JWT_SECRET)
  ctx.state.r = {token}
})

router.post('/register', validate('body', {
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
  firstName: joi.string().trim().optional(),
  lastName: joi.string().trim().optional(),
  bio: joi.string().trim().optional(),
}), async function (ctx) {
  const {email, password, firstName, lastName, bio} = ctx.request.vbody
  await userRepo.ensureEmailNotTaken(email)
  await userRepo.create(email, password, firstName, lastName, bio)
  ctx.state.r = await userRepo.getByEmail(email)
})

module.exports = router
