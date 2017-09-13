const _ = require('lodash')
const joi = require('joi')
const jwt = require('jsonwebtoken')
const router = new (require('koa-router'))()
const uuidv4 = require('uuid/v4')

const error = require('error')
const passwordlessRepo = require('repo/passwordless')
const responder = require('middleware/responder')
const userRepo = require('repo/user')
const validate = require('middleware/validate')
const mailer = require('utils/mailer')

function hasExpired (dateValue) {
  const date = new Date(dateValue)
  date.setUTCHours(date.getUTCHours() + _.toInteger(process.env.PASSWORDLESS_DURATION))
  return date < Date.now()
}

router.use(responder)

router.post('/passwordless/attempt', validate('body', {
  email: joi.string().email().required(),
  originInfo: joi.string().trim().allow('').max(555).optional(),
}), async function (ctx) {
  const {email, originInfo} = ctx.v.body
  const {id: userId} = await userRepo.getByEmail(email)
  const tokenRemote = uuidv4()
  const tokenDirect = uuidv4()
  await passwordlessRepo.create(tokenRemote, tokenDirect, userId)
  await mailer.passwordlessLink(tokenRemote, email, originInfo)
  ctx.state.r = {tokenDirect}
})

router.post('/passwordless/confirm', validate('body', {
  tokenRemote: joi.string().guid({ version: ['uuidv4'] }).required(),
  tokenDirect: joi.string().guid({ version: ['uuidv4'] }).required(),
}), async function (ctx) {
  const {tokenRemote, tokenDirect} = ctx.v.body
  const match = await passwordlessRepo.getByTokens(tokenRemote, tokenDirect)
  if (match.tokenRemote !== tokenRemote) throw new error.GenericError('passwordless.wrong_link', null, 400)
  if (match.tokenDirect !== tokenDirect) throw new error.GenericError('passwordless.wrong_origin', null, 400)
  if (hasExpired(match.createdAt)) throw new error.GenericError('passwordless.expired', null, 400)
  await passwordlessRepo.remove(tokenRemote)
  const token = jwt.sign({id: match.userId}, process.env.JWT_SECRET)
  ctx.state.r = {token}
})

module.exports = router
