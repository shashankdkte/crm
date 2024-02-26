const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const TokenAuth = require("../globalfunction/TokenAuth.js");
const { savevirtualaccount } = require("../globalfunction/savevirtualaccount");
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const axios = require("axios");
const path = require("path");
const multer = require("multer");

// Configure multer storage for file uploads
const storages = multer.diskStorage({
  destination: "./assets/image/userkycdocs",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage: storages,
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|pdf/; // Adjust the allowed file types as per your requirements
    const extname = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedFileTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb("Error: Only jpeg, jpg, png, and pdf files are allowed.");
    }
  },
});

const storage = multer.diskStorage({
  destination: "./assets/image/userdocs",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const uploadImage = multer({
  storage: storage,
});

router.get("/key", (req, res) => {
  const key = "b977803d-0218-456e-a676-79de8c42f4b6";
  const encodedKey = Buffer.from(key).toString("base64");
  const Timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", encodedKey)
    .update(Timestamp)
    .digest("binary");
  const secretKey = Buffer.from(signature, "binary").toString("base64");
  return res.status(200).json({ secretKey, Timestamp });
});

router.get("/get-user-wallet", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;
  var secretToken = req.secretkey;

  const connection = await poolPromise().getConnection();

  try{
    
  const [users] = await connection.query(
    "SELECT * FROM users WHERE unique_id = ?",
    [unique_id]
  );

  if (users[0].secretToken === secretToken) {
    const [wallets] = await connection.query(
      `SELECT * FROM wallet WHERE unique_id = ?`,
      [unique_id]
    );
    console.log(unique_id);
    console.log(wallets);
    var balance = wallets[0].wallet;

    return res.status(200).json({
      statuscode: "1",
      status: "success",
      message: "Available",
      wallet: wallets[0].status,
      userbalance: balance,
    });
  } else {
    return res
      .status(422)
      .json({ status: false, statuscode: "2", message: "Token expired" });
  }

  }catch (error) {
      console.error(error);
      return res.status(500).json({
      status: "fail",
      statuscode: "02",
      message: "Failed to create Remitter",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }

});

router.post("/dmt-history", TokenAuth, async (req, res) => {
  const unique_id = req.users.unique_id;
  const { page, limit, from_date, to_date } = req.body;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  if (!unique_id || !page || !limit || !from_date || !to_date) {
    return res.status(400).json({
      status: "fail",
      statuscode: "0",
      message: "Missing required parameters.",
    });
  }

  const connection = await poolPromise().getConnection();

  try {
    const query = `SELECT bank, recipient_name, account, channel, amount, status, fee, commission, tds, reference_id, time_stamp FROM dmt_transfer WHERE unique_id = ? AND time_stamp BETWEEN ? AND ? LIMIT ?, ?`;
    const values = [
      unique_id,
      from_date + " 00:00:00",
      to_date + " 23:59:59",
      offset,
      parseInt(limit),
    ];
    const [rows] = await connection.execute(query, values);

    if (rows.length > 0) {
      const results = rows.map((item) => {
        const utcTimestamp = item.time_stamp;
        const localDate = moment
          .utc(utcTimestamp)
          .local()
          .format("YYYY-MM-DD HH:mm:ss");
        return { ...item, time_stamp: localDate };
      });

      return res.status(200).json({
        status: "success",
        statuscode: "1",
        formattedResults: results,
      });
    }

    return res.status(200).json({
      status: "fail",
      statuscode: "0",
      message: "DMT history is not available.",
    });
  } catch (error) {
    console.error("Error executing query:", error);
    return res.status(500).json({
      status: "fail",
      statuscode: "0",
      message: "Failed to retrieve DMT history.",
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.get("/dmt-history", TokenAuth, async (req, res) => {
  const unique_id = req.users.unique_id;
  const { page, limit } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  if (!unique_id || !page || !limit) {
    return res.status(400).json({
      status: "fail",
      statuscode: "0",
      message: "Missing required parameters.",
    });
  }
  
  const connection = await poolPromise().getConnection();
  
  
  try {
    const query = `SELECT bank, recipient_name, account, channel, amount, status, fee, commission, tds, reference_id, time_stamp FROM dmt_transfer WHERE unique_id = ? LIMIT ?, ?`;
    const values = [unique_id, offset, parseInt(limit)];
    const [results] = await connection.query(query, values);

    const formattedResults = results.map((result) => {
      const utcTimestamp = result.time_stamp;
      const localDate = moment
        .utc(utcTimestamp)
        .local()
        .format("YYYY-MM-DD HH:mm:ss");
      return {
        ...result,
        time_stamp: localDate,
      };
    });

    if (results.length > 0) {
      return res
        .status(200)
        .json({ status: "success", statuscode: "1", formattedResults });
    }
    return res.status(200).json({
      status: "fail",
      statuscode: "0",
      message: "DMT history is not available.",
    });
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({
      status: "fail",
      statuscode: "0",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }

});

router.get("/fetch_business_profile", TokenAuth, async (req, res) => {
  const { unique_id, user_type, kyc_status } = req.users;
  const connection = await poolPromise().getConnection();

  
  try{

    if (user_type === "Merchant" && kyc_status !== "KYC_APPROVED") {
      const sql =
        "SELECT entity_type, nature_of_business, legal_name, trade_name, pan_number, gst_no, udyam_number, date_of_registration, registration_no, address FROM business_profile WHERE unique_id = ?";
      const [rows] = await connection.execute(sql, [unique_id]);
  
      if (rows.length > 0) {
        const modifyJson = (json) => {
          const { address, date_of_registration, ...rest } = json[0];
          const dateString = date_of_registration;
          const date = new Date(dateString);
          const formattedDate = date.toISOString().split("T")[0];
          return {
            ...rest,
            date_of_registration: formattedDate,
            address: address,
          };
        };
        const businessProfile = modifyJson(rows);
        return res.json({ status: "success", businessProfile });
      } else {
        return res
          .status(404)
          .json({ status: "fail", message: "Business profile not found" });
      }
    } else {
      return res.status(403).json({ status: "fail", message: "Unauthorized" });
    }

  }catch (error) {
      console.error(error);
      return res.status(500).json({
      status: "fail",
      statuscode: "02",
      message: "Failed to create Remitter",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }

});

router.post(
  "/manage-logo",
  TokenAuth,
  uploadImage.single("bp_logo"),
  async (req, res) => {
    const { unique_id } = req.users;
    const file = req.file;

    const connection = await poolPromise().getConnection();

    try{

      if (file === undefined) {
        connection.release();
        return res
          .status(422)
          .json({ status: "fail", message: "No image file found" });
      }
  
      const filename = file.filename;
      const sql = "UPDATE business_profile SET logo = ? WHERE unique_id = ?";
      const values = [filename, unique_id];
  
      const [result] = await connection.execute(sql, values);
      const affectedRows = result.affectedRows;
  
      if (affectedRows === 0) {
        return res
          .status(422)
          .json({ status: "fail", message: "Unable to update logo image" });
      } else {
        return res.json({
          status: "success",
          message: "Logo updated successfully",
        });
      }

    }catch (error) {
      console.error(error);
      return res.status(500).json({
      status: "fail",
      statuscode: "02",
      message: "Failed to create Remitter",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
  }
);

router.post("/update_kyc", TokenAuth, async (req, res) => {
  try {
    const { unique_id } = req.users;
    const {
      name,
      email_id,
      father_or_spousename,
      date_of_birth,
      gender,
      married,
      occupation,
      anual_income,
      pan_no,
      aadhar_no,
      address,
    } = req.body;

    const connection = await poolPromise().getConnection();

    try {
      const [profilestatus] = await connection.execute(
        "SELECT status FROM profile WHERE unique_id = ?",
        [unique_id]
      );

      const userStatus = profilestatus[0].status;
      if (userStatus === "KYC-Not Submitted" || userStatus === "KYC-Rejected") {
        const sql1 =
          "UPDATE users SET users.name = ?, users.email_id = ? WHERE users.unique_id = ?";
        const values1 = [name, email_id, unique_id];
        const updateuse = await connection.execute(sql1, values1);

        if (updateuse[0].affectedRows === 1) {
          const sql =
            "UPDATE profile SET father_or_spousename = ?, date_of_birth = ?, gender = ?, married = ?, anual_income = ?, pan_no = ?, aadhar_no = ?, address = ?, occupation = ? WHERE unique_id = ?";
          const values = [
            father_or_spousename,
            date_of_birth,
            gender,
            married,
            anual_income,
            pan_no,
            aadhar_no,
            JSON.stringify(address),
            occupation,
            unique_id,
          ];
          const update = await connection.execute(sql, values);

          if (update[0].affectedRows === 1) {
            return res.status(200).json({
              status: "success",
              statuscode: "01",
              message: "KYC documents updated successfully",
            });
          } else {
            return res.status(422).json({
              status: "fail",
              statuscode: "0",
              message: "Failed to update KYC documents",
            });
          }
        } else {
          return res.status(422).json({
            status: "fail",
            statuscode: "0",
            message: "Failed to update KYC documents",
          });
        }
      } else {
        return res.status(422).json({
          status: "fail",
          message: "KYC already submitted or approved",
        });
      }
    } catch (error) {
      console.error("Error executing query:", error);
      return res.status(500).json({ status: "fail", error: error });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({ status: "fail", error: err });
  }
});

router.post(
  "/update_kyc_document",
  TokenAuth,
  upload.fields([
    { name: "pan_front", maxCount: 1 },
    { name: "aadhar_front", maxCount: 1 },
    { name: "aadhar_back", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { unique_id } = req.users;
      const panFront = req.files["pan_front"][0];
      const aadharFront = req.files["aadhar_front"][0];
      const aadharBack = req.files["aadhar_back"][0];
      const photo = req.files["photo"][0];

      const connection = await poolPromise().getConnection();

      try {
        const [profilestatus] = await connection.execute(
          "SELECT status FROM profile WHERE unique_id = ?",
          [unique_id]
        );

        const userStatus = profilestatus[0].status;
        if (
          userStatus === "KYC-Not Submitted" ||
          userStatus === "KYC-Rejected"
        ) {
          const sql =
            "UPDATE profile SET pan_front = ?, aadhar_front = ?, aadhar_back = ?, photo = ?, status = ? WHERE unique_id = ?";
          const values = [
            panFront.filename,
            aadharFront.filename,
            aadharBack.filename,
            photo.filename,
            "KYC-Pending",
            unique_id,
          ];
          const update = await connection.execute(sql, values);

          if (update[0].affectedRows === 1) {
            return res.status(200).json({
              status: "success",
              statuscode: "01",
              message: "KYC documents updated successfully",
            });
          }
          return res.status(422).json({
            status: "fail",
            statuscode: "0",
            message: "Failed to update KYC documents",
          });
        } else {
          return res.status(422).json({
            status: "fail",
            message: "KYC already submitted or approved",
          });
        }
      } catch (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ status: "fail", error: error });
      } finally {
       await connection.release();
      }
    } catch (err) {
      console.error("An error occurred:", err);
      return res.status(500).json({ status: "fail", error: err });
    }
  }
);

router.get("/get-bank", async (req, res) => {
  try {
    const connection = await poolPromise().getConnection();

    try {
      const [results] = await connection.execute(
        "SELECT `bankid`,`bank_name`,`shortcode`,`icon` FROM bank_id"
      );

      if (results.length > 0) {
        return res.status(200).json({ status: "success", results });
      }

      return res.status(200).json({ status: "No data found" });
    } catch (error) {
      console.error("Error executing database query: ", error);
      return res
        .status(500)
        .json({ status: "error", message: "Database query error" });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({ status: "fail", error: err });
  }
});

router.post("/evalue-request", TokenAuth, async (req, res) => {
  try {
    const connection = await poolPromise().getConnection();

    const { amount, mode_of_payment, bank_ref_num } = req.body;

    if (amount <= 0) {
      connection.release();
      return res.status(200).json({
        status: "failed",
        statuscode: "02",
        message: "Invalid amount",
      });
    }

    try {
      const [refData] = await connection.query(
        "SELECT * FROM evalue WHERE bank_ref_num = ?",
        [bank_ref_num]
      );

      if (refData.length > 0) {
        return res.status(200).json({
          status: "failed",
          statuscode: "02",
          message: "Duplicate bank transfer reference no.",
        });
      }

      const [max_order_id] = await connection.query(
        "SELECT MAX(`order_id`) AS max_order_id FROM evalue"
      );
      let order_id = max_order_id[0].max_order_id || 0;
      order_id = parseInt(order_id) + 1;
      order_id = String(order_id);

      const data = {
        requestby: req.users.customer_id,
        unique_id: req.users.unique_id,
        order_id: order_id,
        amount: amount,
        mode_of_payment: mode_of_payment,
        bank_ref_num: bank_ref_num,
      };

      const fieldNames = Object.keys(data).join("`,`");
      const placeholders = Object.keys(data)
        .map((item, key) => (key == Object.keys(data).length - 1 ? "?" : "?,"))
        .join("");

      await connection.query(
        `INSERT INTO evalue (\`${fieldNames}\`) VALUES (${placeholders})`,
        Object.values(data)
      );

      return res.status(200).json({
        status: "success",
        statuscode: "01",
        message: "Request submitted successfully",
      });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }
});

router.post("/add-evalue", TokenAuth, async (req, res) => {
  try {
    const connection = await poolPromise().getConnection();

    const { amount, mode_of_payment, bank_ref_num } = req.body;

    if (amount <= 0) {
      connection.release();
      return res.status(200).json({
        status: "failed",
        statuscode: "02",
        message: "Invalid amount",
      });
    }

    try {
      let [[refData]] = await connection.query(
        "SELECT * FROM evalue WHERE bank_ref_num = ?",
        [bank_ref_num]
      );

      if (refData) {
        return res.status(200).json({
          status: "failed",
          statuscode: "02",
          message: "Duplicate bank transfer reference no.",
        });
      }

      let [[max_order_id]] = await connection.query(
        "SELECT MAX(`order_id`) AS max_order_id FROM evalue"
      );
      let order_id = max_order_id.max_order_id || 0;
      order_id = parseInt(order_id) + 1;
      order_id = String(order_id);

      const data = {
        requestby: req.users.customer_id,
        unique_id: req.users.unique_id,
        order_id: order_id,
        amount: amount,
        mode_of_payment: mode_of_payment,
        bank_ref_num: bank_ref_num,
      };

      const fieldNames = Object.keys(data).join("`,`");
      const placeholders = Object.keys(data)
        .map((item, key) => (key == Object.keys(data).length - 1 ? "?" : "?,"))
        .join("");

      await connection.query(
        `INSERT INTO evalue (\`${fieldNames}\`) VALUES (${placeholders})`,
        Object.values(data)
      );

      return res.status(200).json({
        status: "success",
        statuscode: "01",
        message: "Request submitted successfully",
      });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }
});

router.get("/get-evalue", TokenAuth, async (req, res) => {
  try {
    const connection = await poolPromise().getConnection();

    try {
      const [refData] = await connection.query(
        "SELECT * FROM evalue WHERE unique_id = ?",
        [req.users.unique_id]
      );

      if (refData.length === 0) {
        return res.status(200).json({
          status: "failed",
          statuscode: "02",
          message: "No data found",
        });
      }

      const transformedData = refData.map(
        ({
          order_id,
          update,
          amount,
          mode_of_payment,
          bank_ref_num,
          status,
          approved_by,
          approve_at,
          ...elem
        }) => ({
          order_id,
          update,
          amount,
          mode_of_payment,
          bank_ref_num,
          status,
          approved_by,
          approve_at,
        })
      );

      return res.status(200).json({
        status: "success",
        statuscode: "01",
        data: transformedData,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }
});

router.get("/fetch-va", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;

  const connection = await poolPromise().getConnection();

  try{
  const [users] = await connection.execute(
    "SELECT * FROM users WHERE unique_id = ?",
    [unique_id]
  );

  const [virtual_account] = await connection.execute(
    "SELECT * FROM virtual_account WHERE unique_id = ?",
    [unique_id]
  );

  const [wallet] = await connection.execute(
    "SELECT * FROM wallet WHERE unique_id = ?",
    [unique_id]
  );

  if (virtual_account.length === 0) {
    return res.status(404).json({
      statuscode: "02",
      status: "Faield",
      message: "Data not found!",
    });
  } else {
    return res.status(200).json({
      statuscode: "01",
      status: "Success",

      data: [
        {
          name: virtual_account[0].name,
          bank_name: virtual_account[0].bank,
          ac_no: virtual_account[0].accountnumber,
          ifsc: virtual_account[0].ifsc,
          balance: wallet[0].wallet,
        },
      ],
    });
  }

  }catch (error) {
      console.error(error.message);
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }

});

router.post("/create-va", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;

  const connection = await poolPromise().getConnection();

  try{
    const [virtual_account] = await connection.execute(
      "SELECT * FROM virtual_account WHERE unique_id = ?",
      [unique_id]
    );
  
    if (virtual_account.length >= 1) {
      return res.status(404).json({
        statuscode: "02",
        status: "Fail",
        message: "Virtual account already exist.",
      });
    }
  
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );
  
    const mobile = users[0].mobile;
    const email_id = users[0].email_id;
    const usertype = users[0].user_type;
    const customer_id = users[0].customer_id;
    const package_id = users[0].package_id;
    const service_id = "8";
  
    if (usertype === "User") {
      return res.status(404).json({
        statuscode: "02",
        status: "Fail",
        message: "You have not access to create business profile.",
      });
    }
  
    const [business_profile] = await connection.execute(
      "SELECT * FROM business_profile WHERE unique_id = ?",
      [unique_id]
    );
  
    const trade_name = business_profile[0].trade_name;
    const pan_number = business_profile[0].pan_number;
    const address = business_profile[0].address;
  
    if (!trade_name || !pan_number || !address) {
      return res.status(404).json({
        statuscode: "02",
        status: "Fail",
        message:
          "Business profile incompleted please process to complete business profile.",
      });
    }
    const [users_services] = await connection.query(
      "SELECT * FROM users_services WHERE packages_id = ? AND customer_id = ? AND service_id = ?",
      [package_id, customer_id, service_id]
    );
  
    if (users_services[0].status === "Enable") {
      var test = true;
      savevirtualaccount(
        req,
        res,
        unique_id,
        trade_name,
        pan_number,
        address,
        test
      );
    } else {
      return res.status(200).json({
        statuscode: "02",
        status: "Faield",
        message: "Your Services are not enable.",
      });
    }
  }catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  } finally {
    await connection.release();
  }


});

router.post("/vpa-validation", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;
  const { upi_id } = req.body;
  if (!upi_id) {
    return res
      .status(404)
      .json({ status: "Failed", message: "Missing UPI Id!" });
  }

  const connection = await poolPromise().getConnection();

  try{
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );
  
    function generateYearMonth() {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      return `${year}${month}`;
    }
    const yearMonth = generateYearMonth();
    const [[get_reff_id]] = await connection.query(
      "SELECT MAX(`reference_id`) as max_reference_id FROM vpa_validate"
    );
    let reference_id = yearMonth + Number(7654321);
    if (get_reff_id?.max_reference_id) {
      reference_id = Number(get_reff_id.max_reference_id) + Number(1);
    }
  
    const prover_name = "decentro";
    const [headers_key] = await connection.execute(
      "SELECT * FROM vender_key WHERE prover_name = ?",
      [prover_name]
    );
    const apiurl = `${headers_key[0].bash_url}/v2/payments/vpa/validate`;
    const requestBody = {
      reference_id: String(reference_id),
      upi_id: upi_id,
    };
    const headers = {
      client_id: headers_key[0].value,
      client_secret: headers_key[0].value_1,
      module_secret: headers_key[0].value_3,
      provider_secret: headers_key[0].value_4,
      "Content-Type": "application/json",
    };
  
    try {
      const data = await axios.post(apiurl, requestBody, { headers });
  
      var response = data.data;
  
      var requestSuccess = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
      const vpa_validate = {
        unique_id: unique_id,
        reference_id: reference_id,
        timestamp: Date.now(),
        upi_id: upi_id,
        status: data.data.status,
        request: JSON.stringify(requestSuccess),
        response: JSON.stringify(response),
      };
  
      const [get_vpa] = await connection.query("INSERT INTO vpa_validate SET ?", [
        vpa_validate,
      ]);
  
      return res.status(200).json({
        statuscode: "01",
        status: "Success",
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      var response = error.response.data;
      var requestErr = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
      const vpa_validate = {
        unique_id: unique_id,
        reference_id: reference_id,
        timestamp: Date.now(),
        upi_id: upi_id,
        status: "Failed",
        request: JSON.stringify(requestErr),
        response: JSON.stringify(response),
      };
      const [get_vpa] = await connection.query("INSERT INTO vpa_validate SET ?", [
        vpa_validate,
      ]);
  
      return res.status(404).json({
        statuscode: "2",
        status: "Fail",
        message: error.response.data.message,
      });
    }
  }catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  } finally {
    await connection.release();
  }



});

router.post("/generate-upi-link", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;
  var { amount, message } = req.body;
  if (!amount || !message) {
    return res
      .status(404)
      .json({ status: "Failed", message: "Required amount & message!" });
  }

  const connection = await poolPromise().getConnection();
  const [[users]] = await connection.execute(
    "SELECT * FROM users WHERE unique_id = ?",
    [unique_id]
  );

  const [[services_manager]] = await connection.execute(
    "SELECT * FROM services_manager WHERE id = ?",
    ["6"]
  );

  const [[users_services]] = await connection.execute(
    "SELECT * FROM users_services WHERE service_id = ? AND packages_id = ?",
    [services_manager.id, users.package_id]
  );

  if (users_services.status === "Disable") {
    return res.status(404).json({ message: "Services not enable." });
  }

  const [[collection_scheme]] = await connection.execute(
    "SELECT * FROM e_collection_scheme WHERE packages_id = ? AND type = ?",
    [users.package_id, "UPI"]
  );

  function generateYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    return `${year}${month}`;
  }
  const yearMonth = generateYearMonth();
  const [[get_reff_id]] = await connection.query(
    "SELECT MAX(`reference_id`) as max_reference_id FROM upi_collection"
  );
  let reference_id = yearMonth + Number(7654321);
  if (get_reff_id?.max_reference_id) {
    reference_id = Number(get_reff_id.max_reference_id) + Number(1);
  }

  const prover_name = "decentro";
  const [headers_key] = await connection.execute(
    "SELECT * FROM vender_key WHERE prover_name = ?",
    [prover_name]
  );
  const apiurl = `${headers_key[0].bash_url}/v2/payments/upi/link`;
  const headers = {
    client_id: headers_key[0].value,
    client_secret: headers_key[0].value_1,
    module_secret: headers_key[0].value_3,
    provider_secret: headers_key[0].value_4,
    "Content-Type": "application/json",
  };

  const [virtual_account] = await connection.execute(
    "SELECT * FROM virtual_account WHERE unique_id = ?",
    [unique_id]
  );

  const requestBody = {
    reference_id: String(reference_id),
    payee_account:
      users.user_type == "User"
        ? process.env.DEFAULT_VA
        : virtual_account[0].accountnumber,
    amount: Number(amount),
    purpose_message: message,
    generate_qr: 1,
    expiry_time: 10,
    customized_qr_with_logo: 0,
    generate_uri: 1,
  };
  try {
    const data = await axios.post(apiurl, requestBody, { headers });

    var response = data.data;

    var requestSuccess = {
      headers,
      apiurl: apiurl,
      requestBody: requestBody,
    };

    const body_request = {
      unique_id: unique_id,
      reference_id: reference_id,
      payee_account:
        users.user_type == "User"
          ? process.env.DEFAULT_VA
          : virtual_account[0].accountnumber,
      status: "Pending",
      message: message,
      timestamp: Date.now(),
      amount: Number(amount),
      request: JSON.stringify(requestSuccess),
      response: JSON.stringify(response),
      tnxid: data.data.decentroTxnId,
    };

    const [upi_collection] = await connection.query(
      "INSERT INTO upi_collection SET ?",
      [body_request]
    );

    const { transactionStatus, generatedLink, pspUri, encodedDynamicQrCode } =
      data.data.data;

    return res.status(200).json({
      statuscode: "01",
      status: "Success",
      message: data.data.message,
      data: {
        transactionStatus,
        generatedLink,
        pspUri,
        encodedDynamicQrCode,
      },
    });
  } catch (error) {
    //err in this exp....
    // console.log(error);
    var response = error?.response?.data;
    var requestErr = {
      headers,
      apiurl: apiurl,
      requestBody: requestBody,
    };

    const body_request = {
      unique_id: unique_id,
      reference_id: reference_id,
      payee_account:
        users.user_type == "User"
          ? process.env.DEFAULT_VA
          : virtual_account[0].accountnumber,
      status: "Failed",
      message: message,
      timestamp: Date.now(),
      amount: Number(amount),
      request: JSON.stringify(requestErr),
      response: JSON.stringify(response),
      tnxid: response?.decentroTxnId,
    };
    const [upi_collection] = await connection.query(
      "INSERT INTO upi_collection SET ?",
      [body_request]
    );
    return res.status(404).json({
      statuscode: "2",
      status: "Fail",
      message: error?.response?.data.message,
    });
  }
});

router.post("/collection-request", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;
  const { payer_upi, amount, payee_account, message } = req.body;
  if (!payer_upi || !amount || !message) {
    return res.status(404).json({
      status: "Failed",
      message: "Require payer_upi, message & amount!",
    });
  }

  const connection = await poolPromise().getConnection();

  try{
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );
  
    if (users[0].user_type === "User") {
      return res.status(404).json({
        statuscode: "02",
        status: "fail",
        message: "This faclity User have not use!",
      });
    }
  
    const [[services_manager]] = await connection.execute(
      "SELECT * FROM services_manager WHERE id = ?",
      ["10"]
    );
  
    if (services_manager.status === "Disable") {
      return res
        .status(404)
        .json({ statuscode: "02", message: "Services not enable." });
    }
  
    const [[collection_scheme]] = await connection.execute(
      "SELECT * FROM e_collection_scheme WHERE packages_id = ? AND type = ?",
      [users[0].package_id, "UPI"]
    );
  
    const min = collection_scheme.minimum_amt;
    const max = collection_scheme.maximum_amt;
    const fee = collection_scheme.platform_fee;
    const gst = collection_scheme.gst;
  
    //if (min > amount || max < amount) {
      //return res.status(404).json({
        //message: `Amount should be less than ${max} and gretter than ${min}`,
      //});
    //}
  
    function generateYearMonth() {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      return `${year}${month}`;
    }
    const yearMonth = generateYearMonth();
    const [[get_reff_id]] = await connection.query(
      "SELECT MAX(`reference_id`) as max_reference_id FROM upi_collection"
    );
    var num = "00054321";
    let reference_id = yearMonth + Number(num);
    if (get_reff_id?.max_reference_id) {
      reference_id = Number(get_reff_id.max_reference_id) + Number(1);
    }
  
    const [virtual_account] = await connection.execute(
      "SELECT * FROM virtual_account WHERE unique_id = ?",
      [unique_id]
    );
  
    if (!virtual_account[0].accountnumber) {
      return res.status(404).json({
        statuscode: "02",
        status: "Fail",
        message: "Account number not found!",
      });
    }
  
    const requestBody = {
      reference_id: String(reference_id),
      payer_upi: payer_upi,
      payee_account: virtual_account[0].accountnumber,
      amount: Number(amount),
      purpose_message: message,
      expiry_time: 30,
      generate_qr: 1,
      customized_qr_with_logo: 0,
      generate_uri: 1,
    };
    const prover_name = "decentro";
    const [headers_key] = await connection.execute(
      "SELECT * FROM vender_key WHERE prover_name = ?",
      [prover_name]
    );
    const apiurl = `${headers_key[0].bash_url}/v2/payments/collection`;
    const headers = {
      client_id: headers_key[0].value,
      client_secret: headers_key[0].value_1,
      module_secret: headers_key[0].value_3,
      provider_secret: headers_key[0].value_4,
      "Content-Type": "application/json",
    };
  
    try {
      const data = await axios.post(apiurl, requestBody, { headers });
  
      var response = data.data;
      console.log(response);
      var requestSuccess = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
  
      const upi_collection = {
        timestamp: Date.now(),
        unique_id: unique_id,
        payee_account: virtual_account[0].accountnumber,
        reference_id: reference_id,
        payer_upi: payer_upi,
        amount: Number(amount),
        message: message,
        tnxid: data.data.decentroTxnId,
        status: "PENDING",
        request: JSON.stringify(requestSuccess),
        response: JSON.stringify(response),
        npciTransactionId: data.data.data.npciTransactionId,
        bankReferenceNumber: data.data.data.bankReferenceNumber,
      };
      const [get_vpa] = await connection.query(
        "INSERT INTO upi_collection SET ?",
        [upi_collection]
      );
      return res.status(200).json({
        statuscode: "01",
        status: "Success",
        message: data.data.message,
        data: data.data.data,
      });
    } catch (error) {
      var response = error.response.data;
      var requestErr = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
  
      const upi_collection = {
        timestamp: Date.now(),
        unique_id: unique_id,
        payee_account: virtual_account[0].accountnumber,
        reference_id: reference_id,
        payer_upi: payer_upi,
        amount: Number(amount),
        message: message,
        tnxid: response.decentroTxnId,
        status: "Faield",
        request: JSON.stringify(requestErr),
        response: JSON.stringify(response),
      };
      const [get_vpa] = await connection.query(
        "INSERT INTO upi_collection SET ?",
        [upi_collection]
      );
  
      return res.status(200).json({
        statuscode: "2",
        status: "Fail",
        message: error.response.data.message,
      });
    }

  }catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  } finally {
    await connection.release();
  }
 
});

///subscription start

router.get("/view-packages", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {user_type } = req.users;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "failed", message: "Please Provide API KEY." });
  }

  if (user_type === "User" || user_type === "user") {
    return res
      .status(422)
      .json({ status: "failed", message: "User type is user" });
  }

  const connection = await poolPromise().getConnection();
  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
    } else {
      const sql1 = "SELECT package_id, packname, price, discount, total, duration FROM scheme WHERE usertype = ?";
      const value1 = [user_type];
      const [scheme] = await connection.query(sql1, value1);
      
      if (scheme.length > 0) {
        return res.json({
          statuscode: "1",
          status: "success",
          data: scheme,
        });
      } else {
        return res.json({
          statuscode: "2",
          status: "failed",
          message: "user type is not available.",
        });
      }
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to View Packages",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}


});

router.post("/subscription", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {unique_id } = req.users;
  var { package_id, mac_id } = req.body;

  if (!apikey) {
    return res
      .status(422)
      .json({statuscode: "2", status: "failed", message: "Please Provide API KEY." });
  }

  const connection = await poolPromise().getConnection();
  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({statuscode: "2", status: "fail", message: "INVALID API KEY." });
    } else {

      const [saveusers] = await connection.query(
        "SELECT * FROM users WHERE mac_id = ? AND unique_id = ? ",
        [mac_id, unique_id]
      );
      
      if (saveusers.length === 0) {
        return res.status(422).json({statuscode: "2", status: "failed", message: " Invalid mac id" });
    
      }else{
        if (saveusers[0].package_id === package_id) {
          return res
            .status(422)
            .json({ status: "failed", message: "You have the already Subscribed" });
        } else{
          const [wallets] = await connection.query(
            `SELECT * FROM wallet WHERE unique_id = ?`,
            [unique_id]
          );

          const sql1 = "SELECT * FROM scheme WHERE package_id = ?";
          const value1 = [package_id];
          const [scheme] = await connection.query(sql1, value1);

          if(wallets[0].wallet >= scheme[0].total && wallets[0].status === "Enable" ){

            // wallet summary 
            const update_amount = Number(wallets[0].wallet) - Number(scheme[0].total);
  
          await connection.query(
            "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
            [update_amount, unique_id]
          );
  
          const [results] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
          );
  
          var tran_id_ = results[0].max_tran_id || 0;
          var tran_id_w_ = tran_id_ + 1;
          var description_ = `this Subscription Cost Rs${update_amount}/- debit from your Wallet.`;
  
          const [update_wallet] = await connection.query(
            "SELECT * FROM wallet WHERE unique_id = ?",
            [unique_id]
          );
  
          await connection.query(
            "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              unique_id,
              tran_id_w_,
              "DR",
              scheme[0].total,
              "Success",
              description_,
              update_wallet[0].wallet,
            ]
          );

            
          const [admin_wallet] = await connection.query(   
            "SELECT * FROM admin_wallet WHERE status = ?",
            ["Enable"]
          );
  
          var bal_amount = Number(admin_wallet[0].wallet) + Number(scheme[0].total);
  
          await connection.query(
            "UPDATE admin_wallet SET wallet = ? WHERE id  = ?",
            [bal_amount, admin_wallet[0].id]
          );
  
          const [wallet] = await connection.query(
            "SELECT * FROM wallet WHERE unique_id = ?",
            [unique_id]
          );
  
          const [result] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summary"
          );
  
          var tran_id = result[0].max_tran_id || 0;
          var tran_id_w = tran_id + 1;
          var description = `this Subscription Cost Rs${update_amount}/- Credit to admin Wallet.`;
  
          const admin_summary = {
            tran_id: tran_id_w,
            unique_id: "bf508e4f-b685-11ec-9735-00163e0948d5",
            ac_type: "wallet",
            type: "CR",
            amount: scheme[0].total,
            description: description,
            clo_bal: bal_amount,
            status: "Success",
          };
  
          await connection.query("INSERT INTO admin_wallet_summary SET ?", [
            admin_summary,
          ]);
  
            // wallet summary end
            
            //schemesummary start 
            
            const currentTimestamp = Date.now();
            const currentDate = new Date(currentTimestamp);
            const expiryDays = scheme[0].duration;
            const expiryTimestamp = currentTimestamp + (expiryDays * 24 * 60 * 60 * 1000);
            const expiryDate = new Date(expiryTimestamp);
            
            const activedate = currentDate.toISOString().substring(0, 10);
            const expiredate = expiryDate.toISOString().substring(0, 10);

            const timestamp = Date.now().toString(); // Get current timestamp
            const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, "0"); // Generate 4 random digits
            
            const order_id = timestamp+randomDigits;
            const order_by = saveusers[0].name;
            const users_type = saveusers[0].user_type;
            const customer_id = saveusers[0].customer_id;
            const packid = scheme[0].package_id;
            const packname = scheme[0].packname;
            const price = scheme[0].price;
            const gst = scheme[0].gst;
            const total = scheme[0].total;
            const status = "Success";
            const validity = scheme[0].duration;
            
           const schemesamary = {
            order_id,
            order_by,
            users_type,
            customer_id,
            packid,
            packname,
            price,
            gst,
            total,
            status,
            validity,
            activedate,
            expiredate 
            }
            const [schemesummary] = await connection.query(
              "INSERT INTO schemesummary SET ?",
              [schemesamary]
            );
            if (schemesummary.affectedRows === 0) {
              connection.release();
              return res
                .status(500)
                .json({ success: false, message: "Internal server error in schemesummary" });// need change
            }

            //schemesummary end
            //user table update start
            const [updateUsers] = await connection.execute(
              "UPDATE users SET expiry = ?, package_id = ? WHERE unique_id = ?",
              [
                expiredate,
                packid,
                unique_id
              ]
            );
            if (updateUsers.affectedRows === 0) {
              connection.release();
              return res
              .status(500)
              .json({ success: false, message: "Internal server error in updateUsers" });// need change
            }
            
            //user table update end

            //users_services table update or insert start
              
              const [serviceData] = await connection.execute(
                "SELECT * FROM service_with_packages WHERE packages_id = ?",
                [packid]
              );

              if (!serviceData.length) {
                connection.release();
                return res.status(500).json({
                  success: false,
                  message: "No services found for this package",
                });
              }
              
              const [userService] = await connection.execute(
                "SELECT * FROM users_services WHERE customer_id = ? ",
                [customer_id]
              );

              let remainLength = serviceData.length - userService.length;
              if(remainLength > 0){
                var userData1 = serviceData.filter(obj => obj.service_id > userService.length);
                const userData = userData1.map((item) => [
                  customer_id,
                  item.packages_id,
                  item.service_id,
                  item.status,
                ]);
                await insertUserServices(userData);
              }
              
              const userData = serviceData.map((item) => [
                item.packages_id,
                item.status,
                customer_id,
                item.service_id,
              ]);
              // console.log("userData",userData,"userData")

              for (const data of userData) {
                const [users_services] = await connection.query(
                  'UPDATE users_services SET packages_id = ?, status = ? WHERE customer_id = ? AND service_id = ?',
                  [data[0], data[1], data[2], data[3]]
                );
                // console.log("users_services",users_services,"users_services")
              }

            //users_services table update or insert end
            return res.json({
              statuscode: "1",
              status: "success",
              message: "Subscription Successful",
            });
          }else{
            return res
            .status(422)
            .json({ statuscode: "2", status: "failed", message: "Insuffient balance" });
          }
            
        }
      }
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to View Packages",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}


});


router.get("/my-subscription", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {unique_id } = req.users;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "failed", message: "Please Provide API KEY." });
  }

  const connection = await poolPromise().getConnection();
  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
    } else {

      const [users] = await connection.query(
        "SELECT * FROM users WHERE unique_id = ?",
        [unique_id]
      );
      if (users.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "users not found", error: err });
      }

      const [scheme] = await connection.execute(
        "SELECT * FROM scheme WHERE package_id = ?",
        [users[0].package_id]
      );

      if (scheme.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "package not found", error: err });
      }

      return res.json({
        statuscode: "1",
        status: "success",
        data: {
          Package_id: users[0].package_id, 
          "Package name": scheme[0].packname, 
          "Expire Date":moment(users[0].expiry).format("DD-MM-YYYY")
        }
      });
     
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to View My Subscription",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}


});

async function insertUserServices(data) {
  const connection = await poolPromise().getConnection();

  try {
    await connection.query(
      "INSERT INTO users_services (customer_id, packages_id, service_id, status) VALUES ?",
      [data]
    );
  } finally {
    connection.release();
  }
}



///subscription end


router.get("/get-commercial/:urlservices/:subtype", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {package_id } = req.users;
  const urlservices = req.params.urlservices;
  const subtype = req.params.subtype;
  console.log(urlservices,subtype ,package_id)

  if (!urlservices) {
    return res.status(500).send({
      status: "fail",
      statusCode: "02",
      message: "Please provide url services",
    });
  }

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "failed", message: "Please Provide API KEY." });
  }

  const connection = await poolPromise().getConnection();

  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
    } else {

      if(urlservices === "utility" && subtype.length > 0){
        const [utilitySchemeResult] = await connection.query(
          `SELECT operator_name, com_type, commission, conv_charge FROM utility_scheme WHERE category = ? AND package_id = ?`,
          [subtype,package_id]
        );
        return res.json({
          statuscode: "1",
          status: "success",
          data: utilitySchemeResult
        });
      }else if(urlservices === "ecollection" && subtype.length > 0){
        const [collection_scheme] = await connection.execute(
          "SELECT minimum_amt, maximum_amt, fee_type, platform_fee FROM e_collection_scheme WHERE packages_id = ? AND type = ?",
          [package_id, subtype]
        );
        return res.json({
          statuscode: "1",
          status: "success",
          data: collection_scheme
        });
      }else if(urlservices === "dmt"){
        const [dmt_scheme] = await connection.query(
          "SELECT minamount, maxamount, fee, commission FROM dmt_scheme WHERE scheme_id = ?",
          [package_id]
        );
    
        if (dmt_scheme.length === 0) {
          return res.status(404).json({
            statuscode: "2",
            status: "Failed",
            message: "Services is expire.",
          });
        }
        return res.json({
          statuscode: "1",
          status: "success",
          data: dmt_scheme
        });
      }else {
          return res.status(404).json({
            statuscode: "2",
            status: "failed",
            message: "Invalid  url_services and sub_type",
        });
      }
     
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to Get Commercial",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}


});

router.get("/upi-collection", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {unique_id } = req.users;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "failed", message: "Please Provide API KEY." });
  }

  const connection = await poolPromise().getConnection();
  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
    } else {
      const [upi_collection] = await connection.query(
        "SELECT reference_id, payer_upi, amount, `status`, bankReferenceNumber FROM upi_collection WHERE unique_id = ? ",
        [unique_id]
      );

      if (upi_collection.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "failed", message: "upi_collection not found"});
      }

      return res.json({
        statuscode: "1",
        status: "success",
        data: upi_collection
      });
     
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to Get UPI Collection",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}
});


router.get("/ecollection", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const {unique_id } = req.users;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "failed", message: "Please Provide API KEY." });
  }

  const connection = await poolPromise().getConnection();
  try{
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [apikey];
    const [fetchedKey] = await connection.query(sql, value);
  
    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
    } else {//payerName, amount, settl_amt, transferType, response.bankReferenceNumber

      const [virtual_account] = await connection.query(
        "SELECT * FROM virtual_account WHERE unique_id = ?",
        [unique_id]
      );
      if (virtual_account.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "failed", message: "virtual_account not found"});
      }


      const [e_collection] = await connection.query(
        "SELECT payerName, amount, settl_amt, transferType, bankReferenceNumber FROM e_collection WHERE payeeAccountNumber = ?",
        [virtual_account[0].accountnumber] 
      );

      if (e_collection.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "failed", message: "No data available"});
      }

      return res.json({
        statuscode: "1",
        status: "success",
        data: e_collection
      });
     
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
      statuscode: "2",
    status: "failed",
    message: "Failed to Get E-Collection",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}


});



function errHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    res.json({
      status: "fail",
      error: err.code,
      message: err.message,
    });
  }
}
router.use(errHandler);
module.exports = router;
