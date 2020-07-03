# API Skeleton

Backend skeleton to serve an API to [web-skeleton](https://github.com/blazing-edge-labs/web-skeleton).
Can be easily changed/extended for pretty much anything.

Based on Node.js (12), [Koa](https://koajs.com), and PostgreSQL (>10).

## Installation

Having Node.js, and [Yarn](https://yarnpkg.com) already installed:

```
yarn
```

## Initialization

Probably the easiest way to start a fresh local DB for development, is to just use a [Docker](https://www.docker.com) image:

```
docker run --name api-pg -e POSTGRES_USER=api -e POSTGRES_PASSWORD=api -p 5432:5432 -d postgres:10-alpine
```

Create a `.env` file based on `.env.example`:

```
NODE_ENV=development
LOG=5
PORT=3000
WEB_URL=localhost:7000
DATABASE_URL=postgres://api:api@localhost:5432/api
BCRYPT_ROUNDS=10
...
```

To (re)initialize the DB, and run all tests:

```
npm run ci
```

## Start

After initialization, you can start the application in development mode:

```
npm run dev
```

## Viewing DB

You can use any DB client/tool you like, but here are couple we suggest:

### pgweb

The local in-docker DB can be viewed using another docker image:

```
docker run -p 127.0.0.1:8081:8081 --link api-pg:pg -e DATABASE_URL=postgres://api:api@pg:5432/api?sslmode=disable --rm sosedoff/pgweb
```

To connect to a remote DB, beside changing `DATABASE_URL`, you'll have to also remove the `--link api-pg:pg` and `?sslmode=disable` parts.

### psql

`psql` is a common cli tool to work with PostgreSQL. Once installed, you can:
```
psql postgres://api:api@127.0.0.1:5432/api
```
