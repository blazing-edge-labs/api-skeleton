# Application level Permissions - Example

In this document, we are going to see how we can define and implement authorization based on permissions.

In this solution:
- Each user can have any number of roles.
- Each role can have any number of permissions.
- Each endpoint can require certain permissions from the user.

```sql
ALTER TABLE "user"
  ADD "roles" INTEGER[] NOT NULL DEFAULT '{}',

```

All permission and roles are define as constants in `konst.toml`:

```toml
[role.superadmin]
val = 1000
can = '*'

[role.vendor]
val = 100
can = 'payments/*, vendor/*'

[role.buyer]
val = 90
can = 'order/create'

[permission]
list = [
  'superadmin',

  'order/create',

  'vendor/account/read,
  'vendor/account/update,
  'vendor/account/delete,
  'vendor/orders/read',
  'vendor/orders/cancel',
  'vendor/orders/refund',
]
```

All possible permission are listed under `permission.list`.
Each role is stored in DB using respective `val` number. The `can` field holds a "permission selector", and it defines which permissions are included in respective role.

Although it's possible to include user roles in the JWT access token to avoid getting user from DB on each request, that usually means that role changes are not enforced immediately, specially if the access token is long living.
Instead, we are going to load entire user on each authorization (consider to cache users once it becomes slow.)

In `middleware/auth.js`:

```js
const jwt = require('koa-jwt')
const userRepo = require('repo/user')

module.exports = jwt({
  secret: process.env.JWT_SECRET,
  key: 'decodedToken',
  isRevoked: async (ctx, {id}) => {
    const user = await userRepo.getById(id)
    if (user.active) {
      ctx.state.user = user
      return false
    }
    return true
  },
})
```

Such `auth` middleware is used in combination with a `userRoles` middleware to define required permission(s) for a particular endpoint.

```js
router.post('/order', auth, userRoles.can('order/create'),
  async ctx => {
    // ...
  }
)

```

The `middleware/userRoles.js`:

```js
const error = require('error')
const { rolePermissionChecker } = require('utils/roles')

const can = (permissionSelector) => {
  const rolesAreSufficient = rolePermissionChecker(permissionSelector)

  return async (ctx, next) => {
    if (!rolesAreSufficient(ctx.state.user.roles)) {
      throw new error.GenericError('permissions.insufficient', null, 403)
    }
    await next()
  }
}

module.exports = {
  can,
}
```

Where `utils/roles.js`:

```js
const _ = require('lodash')

const konst = require('konst')

const valuesByName = _.mapValues(konst.role, 'val')
const namesByValue = _.invert(valuesByName)

const getRoleValue = role => valuesByName[role]
const getRoleName = value => namesByValue[value]

const expressionFilter = exp => {
  const pat = exp.split('*').map(_.escapeRegExp).join('.*')
  const regexp = new RegExp(`^${pat}$`)
  return it => regexp.test(it)
}

const selectPermissions = selector => {
  selector = selector && String(selector).trim()
  if (!selector) return new Set()

  return new Set(_.flatMap(selector.split(','), exp => {
    exp = exp.trim()
    const res = konst.permission.list.filter(expressionFilter(exp))
    if (res.length === 0) throw new Error(`no permission matching "${exp}"`)
    return res
  }))
}

const permissionsByRole = _.mapValues(konst.role, role => selectPermissions(role.can))

const hasPermission = permission => role => permissionsByRole[role].has(permission)

const checker = permissions => _.memoize(roles => {
  return permissions.every(p => roles.some(hasPermission(p)))
}, String)

const rolePermissionChecker = _.memoize(permissionSelector => {
  return checker(Array.from(selectPermissions(permissionSelector)))
})

module.exports = {
  getRoleName,
  getRoleValue,
  hasPermission,
  selectPermissions,
  rolePermissionChecker,
}

```








