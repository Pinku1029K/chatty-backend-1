const Pool = require("pg").Pool
require("dotenv").config()


const developmentConfig = "postgres://postgres:110029@localhost:5432/chatty?ssl=true"

const productionConfig = process.env.DATABASE_URL

const pool = new Pool({
    connectionString: process.env.NODE_ENV === "dev" ? developmentConfig : productionConfig,
    ssl: {
        rejectUnauthorized: false,
        require: true
    }
 })

 pool.connect()

module.exports = pool