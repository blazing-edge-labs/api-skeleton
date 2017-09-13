const _ = require('lodash')
const nodemailer = require('nodemailer')
const constants = require('const')
const url = require('url')

const { env } = process

const transport = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
})

const sendEmail = options => transport.sendMail(options)

function forgotPassword (email, token) {
  const link = `${env.WEB_URL}${constants.webPath.recoverPasswordPrefix}${token}`

  return sendEmail({
    from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_ADDRESS}>`,
    to: email,
    subject: 'Password recovery',
    text: 'Please use the link to reset your password.',
    html: `
      <p>Please use the link to reset your password.</p>
      <a href='${link}'>Password Recovery</a>`,
  })
}

function passwordlessLink (token, email, originInfo) {
  const query = _({t: token, o: originInfo})
  .omitBy(_.isEmpty)
  .mapValues(encodeURIComponent)
  .value()

  const linkObject = _(url.parse(env.PASSWORDLESS_LOGIN_PAGE, true))
  .omit('search')
  .merge({query})
  .value()

  return sendEmail({
    from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_ADDRESS}>`,
    to: email,
    subject: 'Login',
    text: 'Please use the link to log in.',
    html: `
      <p>Please use the link to log in.</p>
      <a href='${url.format(linkObject)}'>Login</a>`,
  })
}

const stub = {
  cache: transport.sendMail,
  enable () { transport.sendMail = () => Promise.resolve() },
  restore () { transport.sendMail = this.cache },
}

module.exports = {
  forgotPassword,
  passwordlessLink,
  stub,
}
