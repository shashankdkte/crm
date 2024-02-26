const express = require("express");
const app = express();
// Importing process module 
const process = require('process'); 
require("dotenv").config();
const PORT = process.env.PORT || 3009;
console.log({ PORT });
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const moment = require('moment-timezone');
const morgan = require("morgan");
const poolUser = require("./util/connectionPromise");
const authuserRoutes = require("./routes/authuser");
const merchantRoutes = require("./routes/merchant");
const usersRoutes = require("./routes/users");
const dmtRoutes = require("./routes/dmt");
const utilityRoutes = require("./routes/utility");
const callbackRoutes = require("./routes/callback.js");
const common= require("./routes/common.js");
const notification= require("./routes/notification.js");


async function checkDatabaseConnection() {
  try {
    const connectionUser = await poolUser().getConnection();
    const query = "SELECT table_name FROM information_schema.tables";
    await connectionUser.query(query);
    console.log("db running")
    return true;
  } catch (error) {
    console.error("Failed to establish database connection: ", error.message);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.set('trust proxy', true);

app.get('/a', (req, res) => {
  const clientIp = req.ip; // Get the client IP address
  console.log('Client IP:', clientIp);
  res.send('Hello from the server!');
});

app.use((req, res, next) => {
  // Retrieve the client's IP address from X-Forwarded-For header
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Store the client's IP address in the request object
  req.clientIp = clientIp;
  // Continue to the next middleware or route handler
  next();
});

morgan.token('date', (req, res, tz) => {
  return moment().tz(tz).format('DD-MM-YYYY, hh:mm a');
})

// Define a custom token for morgan to get client's IP
morgan.token('client-ip', (req, res) => {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

morgan.token('ip', (req, res, tz) => {
  return req.clientIp || req.ip||'-';
});
morgan.format('myformat', '[:client-ip] [:date[Asia/Calcutta]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms');
app.use(morgan('myformat'));

// Serve static assets
app.use("/assets", express.static(path.join(__dirname, "assets/image")));
const captureResponse = (req, res, next) => {
  // Store the original `res.send` function
  const originalSend = res.send;

  // Override the `res.send` function
  res.send = function (body) {
    // Capture the response data here
    console.log("Response captured:", body);

    // Call the original `res.send` function to send the response
    originalSend.call(this, body);
  };

  // Proceed to the next middleware or route handler
  next();
};

  // Routes callback
app.use("/", callbackRoutes);



app.use(async (req, res, next) => {
    try {
      var apikey = req.headers.apikey;
      if (!apikey) {
        return res.status(422).json({ error: "Please provide an API key" });
      }
  
      const connection = await poolUser().getConnection();
  
      try {
        const [fetchedKey] = await connection.query(
          "SELECT id FROM secret_key WHERE secret_key = ? AND status='Active' ",
          [apikey]
        );
  
        if (fetchedKey.length === 0) {
          return res.status(422).json({
            status: "fail",
            message: "INVALID API KEY",
          });
        } else {
          next();
        }
      } catch (err) {
        return res.status(422).json({ status: "fail", error: err });
      } finally {
        connection.release();
      }
    } catch (error) {
      return res.status(422).json({
        status: "fail",
        message: "INVALID API KEY",
      });
    }
  });

  // Routes
app.use("/authuser", authuserRoutes);
app.use("/merchant", merchantRoutes);
app.use("/users", usersRoutes);
app.use("/dmt", dmtRoutes);
app.use("/utility", utilityRoutes);
app.use("/common", common);
app.use("/push", notification);

// Default route
app.get("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.send("hello");
});


  
// Event 'warning'  
process.on('warning', (warning) => { 
  console.warn("warning stacktrace - " + warning.stack) 
}); 

// Start the server
async function startServer() {
  const databaseConnectionSuccessful = await checkDatabaseConnection();
  if (databaseConnectionSuccessful) {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    console.error(`Failed to start Server due to database connection error`);
  }
}

startServer();
