require('env')
const app = require('app')

app.listen(process.env.PORT, function () {
  console.log(`STARTED ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`)
})
