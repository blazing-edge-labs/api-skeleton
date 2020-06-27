const test = require('test')
const { db, helper } = require('db')
const { mapper, createResolver } = require('repo/base')

function callCounter (fun) {
  const f = function () {
    f.callCount++
    return fun.apply(this, arguments)
  }
  f.callCount = 0
  return f
}

test('map.loading', async t => {
  // A -> (B+, C+ -> B)

  await db.query(`
    CREATE TABLE "test_A" (
      id serial,
      label text,
      primary key (id)
    );
    INSERT INTO "test_A" (label) VALUES ('A1'),('A2'),('A3');

    CREATE TABLE "test_B" (
      id serial,
      a_id int references "test_A" (id),
      label text,
      primary key (id)
    );
    INSERT INTO "test_B" (label, a_id) VALUES ('B1', 1),('B2', 1),('B3', 2);

    CREATE TABLE "test_C" (
      id serial,
      a_id int references "test_A" (id),
      b_id int references "test_B" (id),
      label text,
      primary key (id)
    );
    INSERT INTO "test_C" (label, a_id, b_id) VALUES
    ('C1', 1, 1),
    ('C2', 1, 2),
    ('C3', 2, 3);
  `)

  const mapB = mapper({
    label: 'label',
  })
  const bResolver = createResolver('test_B', 'id', { map: mapB })
  const bOfAResolver = createResolver('test_B', 'a_id', { map: mapB, multi: true })

  const mapC = mapper({
    label: 'label',
    b: ['b_id', bResolver],
  })
  const cOfAResolver = createResolver('test_C', 'a_id', { map: mapC, multi: true })

  const mapA = mapper({
    label: 'label',
    b: ['id', bOfAResolver],
    c: ['id', cOfAResolver],
  })

  const dbSpy = Object.create(db)
  dbSpy.any = callCounter(db.any)

  const r = await db.any('SELECT * FROM "test_A"')
  .then(mapA.loading({
    b: {},
    c: {
      b: {},
    },
  }, { t: dbSpy }))

  t.is(dbSpy.any.callCount, 3)

  t.deepEqual(r, [
    {
      label: 'A1',
      b: [
        {
          label: 'B1',
        },
        {
          label: 'B2',
        },
      ],
      c: [
        {
          label: 'C1',
          b: {
            label: 'B1',
          },
        },
        {
          label: 'C2',
          b: {
            label: 'B2',
          },
        },
      ],
    },
    {
      label: 'A2',
      b: [
        {
          label: 'B3',
        },
      ],
      c: [
        {
          label: 'C3',
          b: {
            label: 'B3',
          },
        },
      ],
    },
    {
      label: 'A3',
      b: [],
      c: [],
    },
  ])

  {
    const data = Array(400 - 3).fill({ label: 'AA' })
    const columnSet = new helper.ColumnSet(['label'])
    await db.query(helper.insert(data, columnSet, 'test_A'))

    dbSpy.any.callCount = 0

    const a = await db.any('SELECT * FROM "test_A"')
    .then(mapA.loading({ c: { b: {} } }, { t: dbSpy }))

    t.is(a.length, 400)
    t.is(dbSpy.any.callCount, 3, 'auto chunk')
    t.is(a.map(r => r.c.length).filter(Boolean).length, 2)
    t.notOk(a[0].b, 'a.b not loaded')
  }

  await db.query(`
    DROP TABLE "test_C";
    DROP TABLE "test_B";
    DROP TABLE "test_A";
  `)
})
