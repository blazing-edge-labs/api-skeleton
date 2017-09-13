const nodemailer = require('nodemailer')
const constants = require('const')
const util = require('util')

const { env } = process

const transport = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
})

const sendEmail = util.promisify(transport.sendMail.bind(transport))

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

module.exports = {
  sendEmail,
  forgotPassword,
}
