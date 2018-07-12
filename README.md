# API Skeleton

Backend to serve an API to [web-skeleton](https://github.com/blazing-edge-labs/web-skeleton).

Based on Node.js (8), [Koa](https://koajs.com), and PostgreSQL (9.6).

## Installation

Having Node.js, and [Yarn](https://yarnpkg.com) already installed:

```
$ yarn
```

## Initialization

Probably the easiest way to start a fresh local DB for development, is to just use a [Docker](https://www.docker.com) image:

```
$ docker run --name api_db -e POSTGRES_USER=api -e POSTGRES_PASSWORD=api -p 5432:5432 -d postgres:9.6-alpine
```

Such DB can be easily viewed using another docker image:

```
$ docker run -p 8081:8081 --link api_db:db -e DATABASE_URL=postgres://api:api@db:5432/api?sslmode=disable --rm sosedoff/pgweb
```

To (re)initialize the DB, and to run all tests:

```
$ npm run ci
```

## Start

After initialization, you can start the application in development mode:

```
$ npm run dev
```
