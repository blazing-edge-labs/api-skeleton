const test = require('test')
const { asyncMap } = require('utils/promise')
const { mapper, loader } = require('./base')
const { db } = require('db')

test('loader', async t => {
  await db.query`
    CREATE TABLE test_loader (
      id int,
      group_num int
    );
    INSERT INTO test_loader (id, group_num) VALUES
    (1, 1),
    (2, 1),
    (3, 1),
    (4, 1),
    (5, 1),
    (6, 2),
    (7, 2),
    (8, 3);
  `

  const map = mapper({
    id: 'id',
    group: 'group_num',
  })

  const loadByIdWith = loader.selectOne({ from: 'test_loader', by: 'id', map })
  const loadByGroupWith = loader.selectAll({ from: 'test_loader', by: 'group_num', where: '"id" > 5 ORDER BY "id" DESC', map })

  const loadById = loadByIdWith(db)
  const promise = loadById(8)
  t.ok(promise === Promise.resolve(promise), 'loader returns a promise')
  t.ok(promise === loadById(8), 'loader should cache by key')
  t.ok(loadById === loadByIdWith(db), 'for same DB, loaderWith should return same loader')
  t.deepEqual(await promise, { id: 8, group: 3 })
  const promise2 = loadById(8)
  t.ok(promise !== promise2, 'after loading, it should not be cached any more')

  const loadByGroup = loadByGroupWith(db)
  t.ok(loadByGroup === loadByGroupWith(db), 'for same DB, loaderWith should return same loader')
  t.deepEqual((await loadByGroup(2)).sort((a, b) => a.id - b.id), [
    { id: 6, group: 2 },
    { id: 7, group: 2 },
  ])

  await db.tx(async tx => {
    const txLoadById = loadByIdWith(tx)

    t.ok(txLoadById !== loadById, 'loaderWith for different t should return different loader')

    const promise3 = txLoadById(8)
    t.ok(promise3 !== promise2, 'loader cache should differ for different t')
    t.ok(txLoadById === loadByIdWith(tx), 'for same tx, loaderWith should return same loader')
    t.deepEqual(await promise3, { id: 8, group: 3 })
    const promise4 = txLoadById(8)
    t.ok(promise3 !== promise4, 'after loading, it should not be cached any more')
    await promise4

    t.deepEqual(await asyncMap([1, 7, 3, 5], txLoadById), [
      { id: 1, group: 1 },
      { id: 7, group: 2 },
      { id: 3, group: 1 },
      { id: 5, group: 1 },
    ])

    t.deepEqual(await asyncMap([1, 2, 3], loadByGroupWith(tx)), [
      [],
      [
        { id: 7, group: 2 },
        { id: 6, group: 2 },
      ],
      [
        { id: 8, group: 3 },
      ],
    ])
  })

  await db.query`DROP TABLE test_loader`
})
