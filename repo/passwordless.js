const error = require('error')
const {db} = require('db')
const {mapper} = require('repo/base')

const map = mapper({
  tokenRemote: 'token_remote',
  tokenDirect: 'token_direct',
  userId: 'user_id',
  createdAt: 'created_at',
})

async function create (tokenRemote, tokenDirect, userId) {
  return db.none(`
    INSERT INTO
    passwordless (token_remote, token_direct, user_id)
    VALUES ($1, $2, $3)
  `, [tokenRemote, tokenDirect, userId])
  .catch({constraint: 'passwordless_pkey'}, error.db('passwordless.duplicate'))
  .catch({constraint: 'passwordless_token_direct_key'}, error.db('passwordless.duplicate'))
  .catch(error.db('db.write'))
}

async function getByTokens (tokenRemote, tokenDirect) {
  return db.one(`
    SELECT *
    FROM passwordless
    WHERE token_remote = $1
    OR token_direct = $2
  `, [tokenRemote, tokenDirect])
  .then(map)
  .catch(error.queryResultErrorNoData, error('passwordless.not_found'))
  .catch(error.queryResultErrorMultiple, error('passwordless.token_mismatch'))
  .catch(error.db('db.read'))
}

async function remove (tokenRemote) {
  return db.none(`
    DELETE
    FROM passwordless
    WHERE token_remote = $1
  `, [tokenRemote])
  .catch(error.db('db.delete'))
}

module.exports = {
  create,
  getByTokens,
  remove,
}
