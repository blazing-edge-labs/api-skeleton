const faker = require('faker')

const random = {
  email: faker.internet.email(),
  password: faker.internet.password(),
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
  bio: faker.lorem.text(),
}

module.exports = {
  random,
}
