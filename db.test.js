const test = require('test')
const { db } = require('db')
const { delay } = require('utils/promise')

test('parallel sub transactions', async t => {
  await db.sql`
    DROP TABLE IF EXISTS test_tx;
    CREATE TABLE test_tx (
      id SERIAL PRIMARY KEY,
      "desc" TEXT
    )
  `

  async function runQueries (tx) {
    for (const x of [1, 2, 3, 4, 5]) {
      await tx.sql`INSERT INTO test_tx ("desc") VALUES (${`query ${x}`})`
      await delay(100)
    }
  }

  async function runSubTx (tx) {
    await tx.tx(async tx => {
      await tx.sql`INSERT INTO test_tx ("desc") VALUES ('back-rolled\')`
      await delay(2.5e3)
      // eslint-disable-next-line promise/catch-or-return
      delay(100).then(() => tx.sql`INSERT INTO test_tx ("desc") VALUES ('leaked out')'`) // a bug-like case
      .catch(e => t.ok(e)) // a bug-like case
      await db.sql`SOMETHING WRONG`
    }).catch(console.log)
  }

  await db.tx(async tx => {
    await Promise.all([
      runQueries(tx),
      runSubTx(tx),
    ])
  })

  const rows = await db.sql`SELECT "desc" FROM test_tx`

  t.deepEqual(rows, [
    { desc: 'query 1' },
    { desc: 'query 2' },
    { desc: 'query 3' },
    { desc: 'query 4' },
    { desc: 'query 5' },
  ])
})
