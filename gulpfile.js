'use strict'

const clean = require('gulp-clean')
const gulp = require('gulp')
const eslint = require('gulp-eslint')
const shell = require('gulp-shell')
const nodemon = require('gulp-nodemon')
const tape = require('gulp-tape')
const istanbul = require('gulp-istanbul')
const sequence = require('run-sequence')
const tapColorize = require('tap-colorize')
let migrations

const colorizeColors = {
  info: [100, 200, 255],
  fail: [255, 0, 0],
  pass: [0, 255, 0],
}

const paths = {
  src: [
    'app.js',
    './routes/*.js',
    './controllers/**/*.js',
    './middleware/**/*.js',
    './models/**/*.js',
    './utils/**/*.js',
    '!./**/*.test.js',
  ],
  extra: [
    './utils/**/*.js',
    './migrations/**/*.js',
    './models/**/*.js',
  ],
  test: [
    './utils/test/setup.js',
    './controllers/**/*.test.js',
    './middleware/**/*.test.js',
    './models/**/*.test.js',
    './utils/*.test.js',
  ],
}

const database = (arg) => shell.task(`node utils/fixtures/index.js ${arg}`)
const runSeeds = (arg = 'development') => shell.task(
    `NODE_ENV=${arg} npm run sequelize -- db:seed:all`
  )

gulp.task('clear-seeds', () => gulp.src('./seedManifest.js').pipe(clean()))

/*
  Database tasks
*/
gulp.task('db-clean', database('delete'))
gulp.task('db-recreate', database('recreate'))
gulp.task('db-recreate-dev', database('recreate dev'))
gulp.task('run-seeds', runSeeds())
gulp.task('run-seeds-test', runSeeds(process.env.NODE_ENV || 'test'))

/*
  Development tasks
*/
gulp.task('dev-rebuild', callback => {
  process.env.NODE_ENV = 'development'
  sequence('clear-seeds', 'db-recreate-dev', 'migrate-initialize', 'run-seeds', callback)
})

gulp.task('lint-src', () => {
  return gulp.src(paths.src.concat(paths.extra))
    .pipe(eslint())
    .pipe(eslint.format())
})

gulp.task('lint-test', () => {
  return gulp.src(paths.test)
    .pipe(eslint('./.eslintrc.test'))
    .pipe(eslint.format())
})

gulp.task('lint', ['lint-src', 'lint-test'])

/*
  Test tasks
*/
gulp.task('run-tests', function () {
  if (process.env.NODE_ENV !== 'circleci') {
    process.env.NODE_ENV = 'test'
  }
  gulp.src(paths.test)
    .pipe(tape({timeout: 14000, reporter: tapColorize(colorizeColors)}))
    .once('end', () => {
      process.exit(); // eslint-disable-line
    })
})

gulp.task('run-test-cover', () => {
  if (process.env.NODE_ENV !== 'circleci') {
    process.env.NODE_ENV = 'test'
  }
  gulp.src(paths.src)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', () => {
      gulp.src(paths.test)
        .pipe(tape({ timeout: 14000, reporter: tapColorize(colorizeColors) }))
        .pipe(istanbul.writeReports())
        .pipe(istanbul.enforceThresholds({
          thresholds: {
            global: {
              statements: 90,
              branches: 75,
              lines: 90,
              functions: 90,
            },
            each: {
              statements: 70,
              branches: 50,
              lines: 75,
              functions: 85,
            },
          },
        }))
        .once('end', () => {
          // small workaround as centos quits terminal before coverage is fully
          // printed out TODO: see exactly why this is happening
          setTimeout(() => process.exit(0), 10)
        })
    })
})

function getGulpTaskArgument (key) {
  var argumnetIndex = process.argv.indexOf(key)
  var argumnetValue = process.argv[argumnetIndex + 1]
  return (argumnetIndex > 0) ? argumnetValue : undefined
}

gulp.task('migrate', () => {
  // TODO quick fix for different environment
  migrations = require('./migrations')
  var version = getGulpTaskArgument('--version')
  var method = getGulpTaskArgument('--method')
  var specificMigrations = getGulpTaskArgument('--specific')

  if (version && method) {
    migrations.run(version, method, specificMigrations)
  } else {
    console.log('Need to have version and method specified')
    process.exit(1)
  }
})

gulp.task('migrate-initialize', function (cb) {
  // TODO quick fix for test environment
  migrations = require('./migrations')
  migrations.initialize(cb)
})

gulp.task('test', cb => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  sequence('clear-seeds', 'db-clean', 'migrate-initialize', 'run-seeds-test', 'run-tests', cb)
})

gulp.task('test-cover', cb => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  sequence('clear-seeds', 'db-clean', 'migrate-initialize', 'run-seeds-test', 'run-test-cover', cb)
})

gulp.task('test-build', cb => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  sequence('clear-seeds', 'migrate-initialize', 'run-seeds-test', 'run-test-cover', cb)
})

gulp.task('test-rebuild', cb => {
  // TODO quick fix for circle ci environment
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  sequence('clear-seeds', 'db-recreate', 'migrate-initialize', 'run-seeds-test', 'run-test-cover', cb)
})

/*
  Server debug tasks
*/
gulp.task('server-debug', () => {
  nodemon({
    script: './bin/www',
    nodeArgs: ['--debug'],
  })
})

gulp.task('debug', ['server-debug'],
  shell.task('node-inspector --web-port=3465'))
