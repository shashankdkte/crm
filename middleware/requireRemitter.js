const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const poolPromise = require("../util/connectionPromise");

module.exports = async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    return res.status(422).json({ error: "You must be logged in Customer" });
  }
  const connection = await poolPromise().getConnection();
  
  jwt.verify(token, process.env.JWT_KEYS, async (err, payload) => {
    if (err) {
      console.log("error : ", err);
      return res
        .status(422)
        .json({ error: "You must be logged in Customer : " + err });
    }
    const { id } = payload;
    const [results] = await connection.query(
      "SELECT * FROM remitter WHERE mobile = ?",
      [id]
    );
    if (results.length === 0) {
      return res
        .status(400)
        .json({ status: "fail", message: "No merchant is found" });
    }

    moment().tz("Asia/Calcutta").format();
    process.env.TZ = "Asia/Calcutta";
    req.remitter = results[0];

    next();
  });
};
