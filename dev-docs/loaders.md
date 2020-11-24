# Quick Introduction to `loader`

If you are new to the concept of DataLoaders, you can refer to https://github.com/graphql/dataloader.
We use the same concept of batched loading and implemented it with a more functional API.

## Example

In a repo file like `repo/user.js` we could define a loader to load users by its `id`:

```js
const loadByIdWith = loader.selectOne({ from: 'user', by: 'id', map})
```

where `map` is usually the mapper function created with the `mapper` helper.

Let's also define a loader for roles:

```js
const loadRolesByUserIdWith = loader.selectAll({
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
