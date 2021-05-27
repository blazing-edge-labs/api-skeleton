# Quick Introduction to `loader`

If you are new to the concept of DataLoaders, you can refer to https://github.com/graphql/dataloader.
We use the same concept of batched loading and implemented it with a more functional API.

## Example

In a repo file like `repo/user.js` we could define a loader to load users by its `id`:

```js
const loadById = loader.one({ from: 'user', by: 'id', map })
```

where `map` is usually the mapper function created with the `mapper` helper.

Let's also define a loader for roles:

```js
const loadRolesByUserId = loader.all({
  from: 'user_role',
  by: 'user_id',
  where: `NOT "revoked"`
  map: row => row.role,
})
```

Now, let's say there are "order" and "product" tables. Then, in `repo/order.js`, there could be a `list` function.

```js
const {asyncMap, asyncAssign} = require('utils/promise')
const userRepo = require('repo/user')
const productRepo = require('repo/product')

// ... map, ...

async function list ({ limit = 10, includeUsers = false }) {
  const orders = await db.sql`
    SELECT *
    FROM "order"
    LIMIT ${limit}
  `
  .then(map)

  const loadUserWithRoles = async userId => {
    const [user, roles] = await Promise.all([
      userRepo.loadById(userId),
      userRepo.loadRolesByUserId(userId),
    ])
    return { ...user, roles }
  }

  return asyncMap(orders, order => {
    return asyncAssign(order, {
      user: includeUsers ? loadUserWithRoles(order.userId) : undefined,
      products: productRepo.loadByOrderId(order.id)
    })
  })
}
```

## Transactions

When inside a transaction (or task), we have to instruct loaders to use associated Database instance (usually referred with `t` or `db`.)

All loaders created with `loader` will have an `.using(db)` method to do so.

```js
await db.tx(async t => {
  // ...
  const user = await userRepo.loadById.using(t)(userId)
  // ...
})
```

Method also accepts an optional [locking clause](https://www.postgresql.org/docs/9.6/sql-select.html#SQL-FOR-UPDATE-SHARE) as second argument.

```js
async function distributeMonyEqually (userIds) {
  await db.tx(async t => {
    const users = await asyncMap(userIds, userRepo.loadById.using(t, 'FOR UPDATE'))
  
    const totBalance = users.reduce((sum, user) => sum + user.balance, 0)
    const newBalance = totBalance / users.length
  
    await userRepo.updateBalanceToUsers(userIds, newBalance, {t})
  })
}

```

## Auto Memoization

Given same arguments, `.using(...)` returns same loader to ensure batching is not limited to local use.

That means that

```js
async function getFullName (t, userId) {
  const user = await userRepo.loadById.using(t)(userId)
  return `${user.firstName} ${user.lastName}`
}

// -- somewhere else --

const fullNames = await asyncMap(userIds, id => getFullName(t, id))
```

will still batch loading of all those users in a single query, since `loadById.using` calls will return same loader for same `db` instance.

## Loading by custom expression

Sometimes we need to load by normalized keys, or column, or both.

For example, let's say users in your project should be able to login by entering own email address case-insensitively.

One solution could be to store (unique) lower-cased emails in a separate column.

> It's always recommended to also keep email addresses in original form, since some emails could be case-sensitive and sending messages to addresses with altered case could be a security issue.

Maintaining two versions of an address is cumbersome, tho.

Instead of adding a column, we can create an index like:

```SQL
CREATE UNIQUE INDEX user_lower_email_idx ON "user" (lower("email"));
```

Now we would like to have a loader to get users by theirs lower-cased email.

To do so, in the `where` option, you can use `__` as reference to the email input.

```js
const loadByLoginEmail = loader.one({ from: 'user', where: `lower(__) = lower("email")`, map })
```

Now, not only we have certainty that login emails are unique using the index above, but also our loader will use such index to quickly load users (and auto-batch loading of multiple users in a single query.)

## Examples with Joins

```js
// in repo/products.js

const loadByUserId = loader.all({
  select: `DISTINCT ON (p.id, o."user_id") p.*`,
  from: `"order" o, "product" p`,
  where: `__::int = o."user_id" AND p."order_id" = o."id"`,
  orderBy: `"price" DESC`,
  map,
})
```

or

```js
// in repo/products.js

const loadByUserId = loader.all({
  select: `DISTINCT ON (p.id, o."user_id") p.*`,
  from: `"order" o,
    JOIN "product" p ON p."order_id" = o."id"`,
  by: `o."user_id"`,
  orderBy: `"price" DESC`,
  map,
})

```

> NOTE: When using `__`, make sure to cast it to correct type (not necessary if it's a `text`).

## Loaders from Custom Resolvers

`loader(...)` can be used to define loaders by providing your own resolver for keys.

> Note: This is exposed mainly for non-SQL loaders, or for other kind of databases or sources. When possible, it's recommended to use `loader.all` or `loader.one` instead.

```js
const { byKeyed } = require('utils/data')

const loadFullName = loader((db, lockingClause) => async userIds => {
  const rows = await db.sql`
    SELECT id, (first_name || ' ' || last_name) as "fullName"
    FROM "user"
    WHERE id = ANY (${userIds})
    ${sql.raw(lockingClause)} // <- remember to use the second argument
  `

  return userIds.map(byKeyed(rows, 'id', 'fullName', null))
})

const fullName1 = await loadFullName(userId)
const fullName2 = await loadFullName.using(t)(userId)
const fullName3 = await loadFullName.using(t, 'FOR SHARE')(userId)
```

If for some reason your loader should not support locking clauses, just omit the `lockingClause` argument, and any attempt of locking with it, will un-silently fail with `"Loader not supporting locking"`.
