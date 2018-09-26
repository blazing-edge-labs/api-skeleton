const _ = require('lodash')
const connString = require('connection-string')
const konst = require('konst')
const mailer = require('nodemailer')
const url = require('url')

function base64decode (str) {
  return Buffer.from(str, 'base64').toString('ascii')
}

const conn = connString(process.env.MAIL_URL)

if (_.get(conn, 'params.base64', false)) {
  conn.password = base64decode(conn.password)
  conn.user = base64decode(conn.user)
}

const transport = mailer.createTransport({
  host: conn.hostname,
  port: conn.port,
  auth: {
    user: conn.user,
    pass: conn.password,
  },
  secure: conn.protocol === 'smtps',
})
transport.verify().catch(console.error)

const sendEmail = options => transport.sendMail(options)

function forgotPassword (email, token) {
  const link = `${process.env.WEB_URL}${konst.webPath.recoverPasswordPrefix}${token}`

  return sendEmail({
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
    to: email,
    subject: 'Password recovery',
    text: 'Please use the link to reset your password.',
    html: `
      <p>Please use the link to reset your password.</p>
      <a href='${link}'>Password Recovery</a>`,
  })
}

function passwordlessLink (token, email, originInfo) {
  const query = _({ t: token, o: originInfo })
  .omitBy(_.isEmpty)
  .mapValues(encodeURIComponent)
  .value()

  const linkObject = _(url.parse(process.env.PASSWORDLESS_LOGIN_PAGE, true))
  .omit('search')
  .merge({ query })
  .value()

  return sendEmail({
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
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
