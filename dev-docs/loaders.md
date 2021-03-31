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

Now, let's say there are tables "order" and "product". In `repo/order.js` there could be a `list` function.

```js
const {asyncMap, asyncAssign} = require('utils/promise')
const userRepo = require('repo/user')
const productRepo = require('repo/product')

// ... map, ...

async function list ({ limit = 10, includeUsers = false }) {
  const orders = await db.any(`
    SELECT *
    FROM "order"
    LIMIT $[limit]
  `, {limit})
  .then(map)

  const loadUserWithRoles = async userId => {
    const [user, roles] = await Promise.all([
      userRepo.loadById(userId),
      userRepo.loadRolesByUserId(userId),
    ])
    user.roles = roles
    return user
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

All loaders created with `loader` will have a `.using(db)` to do so.

```js
await db.tx(async t => {
  // ...

  const user = await userRepo.loadById.using(t)(userId)
})
```

With loaders created with `loader.one` and `loader.all` you can also specify locking to ensure data is not changed concurrently by another transaction during your update.

```js
async function distributeMonyEqually (userIds) {
  await db.tx(async t => {
    const users = await asyncMap(usersIds, userRepo.loadById.using(t, 'FOR UPDATE'))
  
    const totBalance = users.reduce((sum, user) => sum + user.balance, 0)
    const newBalance = totBalance / users.length
  
    await userRepo.updateBalanceToUsers(usersIds, newBalance, {t})
  })
}

```

Refer to [PG docs](https://www.postgresql.org/docs/9.6/sql-select.html#SQL-FOR-UPDATE-SHARE) for more info on locking options.

## Auto Memoization

`.using(...)` is memoized (will return same result for same inputs) to ensure batching is not limited to local use.

That means that

```js
async function getFullName (userId, { t = db } = {}) {
  const user = await userRepo.loadById.using(t)(userId)
  return `${user.firstName} ${user.lastName}`
}

// -- somewhere else --

const fullNames = await asyncMap(userIds, id => getFullName(id, {t}))
```

will still batch loading of all users in a single query, since `loadById.using` calls will return same loader for same `db` instance.

## Loading by custom expression

Sometimes we need to load by normalized keys, or column, or both.

For example, let's say users in your project should be able to login by entering own email address case-insensitively.

One solution could be to store (unique) lower-cased emails in a separate column.

> It's always recommended to also keep email addresses in original form, since some emails could be case-sensitive and sending messages to addresses with altered case could be a security issue.

Maintaining two versions of an address is cumbersome, tho.

Instead of adding a column, we can create an index like:

```SQL
CREATE UNIQUE INDEX user_lower_email_idx ON "user" ((lower("email")));
```

Now we would like to have a loader to get users by theirs email case-insensitively.

To do so, in the `where` option, you can use `__` to reference to passed key to the loader.

```js
const loadByLoginEmail = loader.one({ from: 'user', where: `lower(__) = lower("email")`, map })
```

Now, not only we have certainty that login emails are unique using the index above, but also our loader will use such index to quickly load users (and auto-batch loading of multiple users in a single query.)

## Examples with Joins

```js
// in repo/products.js

const loadByUserId = loader.all({
  select: `DISTINCT ON (id) p.*`,
  from: `"order" o, "product" p`,
  where: `__ = o."user_id" AND p."order_id" = o."id"`,
  orderBy: `"price" DESC`,
  map,
})
```

or

```js
// in repo/products.js

const loadByUserId = loader.all({
  select: `DISTINCT ON (id) p.*`,
  from: `"order" o,
    JOIN "product" p ON p."order_id" = o."id"`,
  where: `__ = o."user_id"`,
  orderBy: `"price" DESC`,
  map,
})
```

## Loaders from Custom Resolvers

`loader(...)` can be used to define loaders by providing your own resolver for keys.

> Note: This is exposed mainly for non-SQL loaders, or for other kind of databases. When possible, it's recommended to use `loader.all` or `loader.one` instead.

```js
const { byKeyed } = require('utils/data')

const loadFullName = loader((db, lockingClause) => async userIds => {
  const rows = await db.any(`
    SELECT id, (first_name || ' ' || last_name) as "fullName"
    FROM "user"
    WHERE id IN ($1:csv)
    ${lockingClause} // <- note have to used second argument
  `, [userIds])

  return userIds.map(byKeyed(rows, 'id', 'fullName', null))
})

const fullName1 = await loadFullName(userId)
const fullName2 = await loadFullName.using(t)(userId)
const fullName3 = await loadFullName.using(t, 'FOR SHARE')(userId)
```

If for some reason your loader should not support locking clauses, just omit the `lockingClause` argument, and any attempt of locking with it will un-silently fail with `"Loader not supporting locking"`.
