const fs = require('fs')
const toml = require('@iarna/toml')

function parseFile (path) {
  const src = fs.readFileSync(path)

  return toml.parse(src)
}

module.exports = {
  parseFile,
}
