const fs = require('fs')

if (fs.existsSync('.babelrc')) {
  require('babel-register')
}

if (fs.existsSync('.env')) {
  require('dotenv').load()
}

require('migratio/cli')
