const test = require('test')
const { asyncMap } = require('utils/promise')
const { mapper, loader } = require('./base')
const { db } = require('db')

test('loader', async t => {
  await db.query(`
    CREATE TABLE test_loader (
      id int,
      group_num int
    );
    INSERT INTO test_loader (id, group_num) VALUES
    (1, 8),
    (2, 1),
    (3, 1),
    (4, 1),
    (5, 1),
    (6, 2),
    (7, 2),
    (8, 3);
  `)

  const map = mapper({
    id: 'id',
    group: 'group_num',
  })

  const loadById = loader.one({ from: 'test_loader', by: 'id', map })
  const loadByGroup = loader.all({ from: 'test_loader', where: '-__ = -"group_num" AND "id" > 5', orderBy: '"id"', map })

  const promise = loadById(8)
  t.ok(promise === Promise.resolve(promise), 'loader returns a promise')
  t.ok(promise === loadById(8), 'loader should cache by key')
  t.ok(loadById === loadById.using(db), 'for same DB, loaderWith should return same loader')
  t.deepEqual(await promise, { id: 8, group: 3 })
  const promise2 = loadById(8)
  t.ok(promise !== promise2, 'after loading, it should not be cached any more')

  t.ok(loadByGroup === loadByGroup.using(db), 'for same DB, loaderWith should return same loader')
  t.deepEqual(await loadByGroup(2), [
    { id: 6, group: 2 },
    { id: 7, group: 2 },
  ])

  await db.tx(async tx => {
    const txLoadById = loadById.using(tx)

    t.ok(txLoadById !== loadById, 'loaderWith for different t should return different loader')

    const promise3 = txLoadById(8)
    t.ok(promise3 !== promise2, 'loader cache should differ for different t')
    t.ok(txLoadById === loadById.using(tx), 'for same tx, loaderWith should return same loader')
    t.ok(loadById.using(tx, 'FOR SHARE') !== loadById.using(tx, 'FOR UPDATE'), 'for same tx, but different lock, loaderWith should return different loader')
    t.deepEqual(await promise3, { id: 8, group: 3 })
    const promise4 = txLoadById(8)
    t.ok(promise3 !== promise4, 'after loading, it should not be cached any more')
    await promise4

    t.deepEqual(await asyncMap([1, 7, 3, 5], txLoadById), [
      { id: 1, group: 8 },
      { id: 7, group: 2 },
      { id: 3, group: 1 },
      { id: 5, group: 1 },
    ])

    t.deepEqual(await asyncMap([1, 2, 3], loadByGroup.using(tx)), [
      [],
      [
        { id: 6, group: 2 },
        { id: 7, group: 2 },
      ],
      [
        { id: 8, group: 3 },
      ],
    ])
  })

  {
    const loadWithImplicitJoin = loader.one({
      select: 'c.group_num AS "val"',
      from: `test_loader a, test_loader b
        JOIN test_loader c ON b.group_num = c.id
      `,
      where: '__::int = a.id AND a.group_num = b.id',
      orderBy: '1',
      map: r => r.val,
    })

    t.is(await loadWithImplicitJoin(2), 3)
  }

  {
    const loadWithImplicitJoin = loader.one({
      select: 'c.group_num AS "val"',
      from: `test_loader a
        JOIN test_loader b ON a.group_num = b.id
        JOIN test_loader c ON b.group_num = c.id
      `,
      by: 'a.id',
      orderBy: '1',
      map: r => r.val,
    })

    t.is(await loadWithImplicitJoin(2), 3)
  }

  await db.query('DROP TABLE test_loader')
})
