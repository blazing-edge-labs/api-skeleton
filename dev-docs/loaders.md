# Quick Introduction to `loader`

If you are new to the concept of DataLoaders, you can refer to https://github.com/graphql/dataloader.
We use the same concept of batched loading and implemented it with a more functional API.

## Example

In a repo file like `repo/user.js` we could define a loader to load users by its `id`:

```js
const loadByIdWith = loader.one({ from: 'user', by: 'id', map })
```

where `map` is usually the mapper function created with the `mapper` helper.

Let's also define a loader for roles:

```js
const loadRolesByUserIdWith = loader.all({
  from: 'user_role',
  by: 'user_id',
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

  const loadUserById = userRepo.loadByIdWith(db)
  const loadRolesByUserId = userRepo.loadRolesByUserIdWith(db)
  const loadProductsByOrderId = productRepo.loadByOrderIdWith(db)

  const loadUserWithRoles = async userId => {
    const [user, roles] = await Promise.all([
      loadUserById(userId),
      loadRolesByUserId(userId),
    ])
    user.roles = roles
    return user
  }

  return asyncMap(orders, order => {
    return asyncAssign(order, {
      user: includeUsers ? loadUserWithRoles(order.userId) : undefined,
      products: loadProductsByOrderId(order.id)
    })
  })
}
```

## Loader auto-memoization

Loaders are memoized to ensure batching is not limited to local use.

That means that

```js
async function getFullName (userId) {
  const user = await userRepo.loadByIdWith(db)(userId)
  return `${user.firstName} ${user.lastName}`
}

// -- somewhere else --

const fullNames = await asyncMap(userIds, getFullName)
```

will still batch loading of all users in single query, since multiple `userRepo.loadByIdWith(db)` calls will return same loader.

However separating loader preparation form its use, can make things more readable and slightly more efficient.

This is equally true when creating custom loaders with `loader(...)`.

```js
const { byKeyed } = require('utils/data')

const loadFullNameWith = loader((db, sep = ' ') => async userIds => {
  const rows = await db.any(`
    SELECT id, (first_name || $2 || last_name) as "fullName"
    FROM "user"
    WHERE id IN ($1:csv)
  `, [userIds, sep])

  return userIds.map(byKeyed(rows, 'id', 'fullName', null))
})

assert(loadFullNameWith(db) === loadFullNameWith(db)) 
assert(loadFullNameWith(db, ', ') === loadFullNameWith(db), ', ')
```

Note that arguments are compared by identity.

```js
const loadA = myLoader(db, { option1: true })
const loadB = myLoader(db, { option1: true })

console.log(loadA === loadB) // -> false
```

## Loading by custom expression

Sometimes we need to load by normalized keys, or column, or both.

For example, let's say users in your project should be able to login by entering own email address non case-sensitively.

One solution could be to store lower-cased emails in a separate column. It's always recommended to also keep email addresses in original case, since some emails could be case-sensitive and sending messages to addresses with altered case could be a security issue.

Maintaining two versions of an address is cumbersome, tho.

Instead of adding a column, we can create an index like:

```SQL
CREATE UNIQUE INDEX user_lower_email_idx ON "user" ((lower("email")));
```

Now we would like to have a loader to get a user by lowered email.

You have full flexibility to deal with similar situations by using `__` (reference to passed key) inside the `where` option.

```js
const loadByLoginEmailWith = loader.one({ from: "user", where: `lower(__) = lower("email")`, map })
```

Now, not only we have certainty that login emails are unique using the index above, but also our loader will use such index to quickly load users (and auto-batch loading of multiple users in a single query.)

## Using Loaders in Transactions

As we already saw, loaders defined using `loader.one` and `loader.all` fist have to be called with a `db` instance.

When in a transaction, we have to pass to loader the Database instance of the transaction/task (usually referred with `t`.)

```js
await db.tx(async t => {
  // ...

  const user = await userRepo.loadByIdWith(t)(userId)
})
```

You can also specify locking to ensure data is not changed concurrently by another transaction during your update.

```js
async function distributeMonyEqually (userIds) {
  await db.tx(async t => {
    const users = await asyncMap(usersIds, userRepo.loadByIdWith(t, 'FOR UPDATE'))
  
    const totBalance = users.reduce((sum, user) => sum + user.balance, 0)
    const newBalance = totBalance / users.length
  
    await userRepo.updateBalanceToUsers(usersIds, newBalance, {db: t})
  })
}

```
