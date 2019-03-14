# Mapping With Resolvers

This document shows how to use mappers in combination with resolvers to significantly simplify complex read queries.

Here a quick example how it looks like:

```js
// ---- repo/user.js ----
const { mapper, createResolver } = require('repo/base')
const contactRepo = require('repo/contact')
const profileRepo = require('repo/profile')

const map = mapper({
  id: 'id',
  fullName: 'full_name',
  lang: 'lang',
  // ...
  contacts: ['id', contactRepo.byUserIdResolver],
  profile: ['profile_id', profileRepo.byIdResolver],
})

async function getAllUsers (includeProfiles = false) {
  return db.any('SELECT * FROM "user"')
  .catch(error.db)
  .then(map.loading({
    contacts: {},
    profile: includeProfiles && {
      reviews: {},
    },
  })
}


// ---- repo/contact.js ----
const { mapper, createResolver } = require('repo/base')

const map = mapper({
  // ...
  userId: 'user_id',
  deleted: 'deleted',
  // ...
})

const byUserIdResolver = createResolver('contact', 'user_id', { map, multi: true, condition: 'not "deleted"' })


// ---- repo/profile.js ----
const { mapper, createResolver } = require('repo/base')
const reviewRepo = require('repo/review')

const map = mapper({
  // ...
  reviews: ['id', reviewRepo.byProfileIdResolver],
})

const byIdResolver = createResolver('profile', 'id', { map })
```

As you can see, we can very quickly define in a declarative way how complex data can be built by adding extras in mappers and defining needed resolvers. Then, in actual getter functions, like the `getAllUsers`, we can use the `map.loading` utility function to not only map query results, but also to instruct which all extras we need attached to it.
To achieve that, additional data retrieval (possibly parallel) is automatically performed using respective resolvers. This usually results in approximately one select query per table.

## `createResolver`

Resolvers are functions that given an array of 'keys' (usually some ids,) return a promise of respective values in same order. The `createResolver` utility function simplifies definition of such resolvers.

The most common and simpler use of `createResolver` is to define selection from a table based on some 'key' (usually some id used for relations.)

```js
resolver = createResolver(tableName, keyColumnName, options)
```

Possible options are:
- **`map`** - function that is going to be used to map multiple values. This is usually the `map` function of the repo file created with the `mapper` utility function. When required, `map.loading` will be used internally.
- **`multi`** - set to `true` if multiple data per key is expected (1-n relations.)
- **`condition`** - additional SQL condition/filter for all values.
- **`chunkSize`** - ...

When simple table selection is not enough, `createResolver`, instead of a table name, can accept a function that performs the actual DB query (or other kind of retrieval.)

For example, we can define a resolver to retrieve some data based on some 'key' of a 'join' table:

```js
// ---- repo/author.js

const map = mapper({
  fullName: 'fullName',
  // ...
})

const byBookIdResolver = createResolver(
  (bookIds, { t = db }) => t.any(`
    SELECT a.*
    FROM "author" a
    JOIN "author_book_rel" r ON r.author_id = a.id
    WHERE r.book_id IN ($1:csv)
  `, [bookIds])
  .catch(error.db),
  // keyColumn still needed
  'book_id',
  { map, multi: true }
)


// ---- repo/book.js ----

const map = mapper({
  title: 'title',
  publisherId: 'publisher_id',
  // ...
  authors: ['id', authorRepo.byBookIdResolver]
})

```
