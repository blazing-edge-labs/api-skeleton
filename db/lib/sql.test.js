/* eslint-disable quotes */
const test = require('test')

const { sql } = require('./sql')

const unindent = str => str.trim().replace(/\n\s*/g, ' ')
const unindentRaw = (...args) => unindent(String.raw(...args))

test('simple template', t => {
  const table = 'tab"le'
  const data = [1, 'hel\'lo', { x: [1] }, ['world']]

  const res = sql`SELECT * FROM "${table}" WHERE data = ${data} AND age > ${18}`

  t.is(res.toPlainQuery(), `SELECT * FROM "tab""le" WHERE data = array[1,'hel''lo','{"x":[1]}',array['world']] AND age > 18`)

  const { text, values } = res.toPgQuery()
  t.is(text, `SELECT * FROM "tab""le" WHERE data = $1 AND age > $2`)
  t.deepEqual(values, [data, 18])
})

test('template composition', t => {
  const sql1 = sql`SELECT * FROM "table1" WHERE id = ANY(${[1, 2, 3]})`
  const sql2 = sql`SELECT * FROM "table2" WHERE ref IN (${sql1}) AND type = ${4}`

  const plain = sql2.toPlainQuery()
  const { text, values } = sql2.toPgQuery()

  t.is(plain, `SELECT * FROM "table2" WHERE ref IN (SELECT * FROM "table1" WHERE id = ANY(array[1,2,3])) AND type = 4`)
  t.is(text, `SELECT * FROM "table2" WHERE ref IN (SELECT * FROM "table1" WHERE id = ANY($1)) AND type = $2`)
  t.deepEqual(values, [[1, 2, 3], 4])
})

test('sql.update', t => {
  const sql1 = sql.update({
    table: 'user',
    where: { id: 1 },
    set: { name: 'Alex', human: true },
    skipEqual: true,
    returning: '*',
  })

  const plain = sql1.toPlainQuery()
  const { text, values } = sql1.toPgQuery()

  t.is(unindent(plain), unindentRaw`
    UPDATE "user"
    SET ("name","human") = ('Alex',true)
    WHERE ("id" = 1)
      AND ("name","human") IS DISTINCT FROM ('Alex',true)
    RETURNING *
  `)

  t.is(unindent(text), unindentRaw`
    UPDATE "user"
    SET ("name","human") = ($1,$2)
    WHERE ("id" = $3)
      AND ("name","human") IS DISTINCT FROM ($1,$2)
    RETURNING *
  `)

  t.deepEqual(values, ['Alex', true, 1])
})

test('upsert with sql.insert', t => {
  const upsertSql = sql.insert({
    into: 'user',
    data: { id: 1, name: 'Ivan' },
    onConflict: 'id',
    update: true,
    skipEqual: true,
    returning: ['id'],
  })

  const plain = upsertSql.toPlainQuery()
  const { text, values } = upsertSql.toPgQuery()

  t.is(unindent(plain), unindentRaw`
    INSERT INTO "user" t ("id","name") VALUES
    (1,'Ivan')
    ON CONFLICT ("id") DO UPDATE
    SET ("name") = (Excluded."name")
    WHERE (t."name") IS DISTINCT FROM (Excluded."name")
    RETURNING "id"
  `)

  t.is(unindent(text), unindentRaw`
    INSERT INTO "user" t ("id","name") VALUES
    ($1,$2)
    ON CONFLICT ("id") DO UPDATE
    SET ("name") = (Excluded."name")
    WHERE (t."name") IS DISTINCT FROM (Excluded."name")
    RETURNING "id"
  `)

  t.deepEqual(values, [1, 'Ivan'])
})

test('upsert with sql.insert on minimal columns', t => {
  const upsertSql = sql.insert({
    into: 'user',
    data: { id: 7 },
    onConflict: 'id',
    update: true,
    skipEqual: true,
    returning: ['id'],
  })

  const plain = upsertSql.toPlainQuery()
  const { text, values } = upsertSql.toPgQuery()

  t.is(unindent(plain), unindentRaw`
    INSERT INTO "user" t ("id") VALUES
    (7)
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
  `)

  t.is(unindent(text), unindentRaw`
    INSERT INTO "user" t ("id") VALUES
    ($1)
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
  `)

  t.deepEqual(values, [7])
})

test('upsert with sql.insert on minimal columns but no skipEqual', t => {
  let error

  try {
    sql.insert({
      into: 'user',
      data: { id: 7 },
      onConflict: 'id',
      update: true,
    })
    .toPlainQuery()
  } catch (e) {
    error = e
  }

  t.is(error.message, 'no columns to update')
})
