const _ = require('lodash')
const konst = require('konst')
const mailer = require('nodemailer')
const url = require('url')
const { ConnectionString } = require('connection-string')

const conn = new ConnectionString(process.env.MAIL_URL)

const transport = mailer.createTransport({
  auth: {
    pass: conn.password,
    user: conn.user,
  },
  host: conn.hostname,
  port: conn.port,
})
transport.verify().catch((err) => {
  console.error('invalid mail transport', err)
  process.exit(1)
})

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

  const linkObject = new url.URL(process.env.PASSWORDLESS_LOGIN_PAGE)
  linkObject.search = new url.URLSearchParams(query)

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
