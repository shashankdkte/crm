const { createPool } = require("mysql2/promise");
require("dotenv").config();

var pool = null;
function getDBPool() {
  if (pool && !pool._closed) return pool;

  pool = createPool({
    connectTimeout: 1500,
    host: "103.93.16.46",
    user: "egpaidco_user",
    database: "egpaidco_merchantdata",
    password: "m8@kQFdT#Ehx",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 100000,
    queueLimit: 0,
  });


  return pool;
}

module.exports = getDBPool;

