# Mapping With Resolvers

This document shows how to use mappers in combination with resolvers to significantly simplify complex read queries.

Here a quick example how it looks like:

```js
// ---- repo/user.js ----

const map = mapper({
  id: 'id',
  fullName: 'full_name',
  lang: 'lang',
  // ...
  contacts: ['id', contactsRepo.byUserIdResolver],
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


// ---- repo/contacts.js ----

const map = mapper({
  // ...
  userId: 'user_id',
  deleted: 'deleted',
  // ...
})

const byUserIdResolver = createResolver('contact', 'user_id', { map, multi: true, condition: 'not "deleted"' })


// ---- repo/profile.js ----

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
- **`map`** - function that is going to be used to map multiple values. This is usually the `map` function of the repo file created with the `mapper` utility function. When required, `map.loading` will be used internally if it exists.
- **`multi`** - set to `true` if multiple data per key is expected (1-n relations.)
- **`condition`** - additional SQL condition/filter for all values.
- **`chunkSize`** - ...

When simple table selection is not enough, `createResolver`, instead of a table name, can accept a function that performs the actual DB query (or other kind of retrieval.)

For example, we can define a resolver to retrieve some data based on some 'key' of a 'join' table:

```js
// ---- repo/book.js

const byAuthorIdResolver = createResolver(
  (authorIds, { t = db }) => t.any(`
    SELECT b.*
    FROM "book" b
    JOIN "author_book_rel" r ON r.book_id = b.id
    JOIN "author" a ON r.author_id = a.id
    WHERE a.is IN ($1:csv)
  `, [authorIds])
  .catch(error.db),
  // keyColumn still needed
  'author_id',
  { map, multi: true }
)


// ---- repo/author.js ----

const map = mapper({
  firstName: 'first_name',
  lastName: 'last_name',
  // ...
  books: ['id', bookRepo.byAuthorIdResolver]
})

```
