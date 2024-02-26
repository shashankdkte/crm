const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const SALT = process.env.SALT.toString();
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const TokenAuth = require("../globalfunction/TokenAuth.js");
const path = require("path");
const multer = require("multer");

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
      cb(
        "Error: Only jpeg, jpg, png, and pdf files Other Files are Not allowed."
      );
    }
  },
});

router.get("/app-navigation", TokenAuth, async (req, res) => {
  var unique_id = req.users.unique_id;
  const connection = await poolPromise().getConnection();

  try{
    
  const [users] = await connection.query(
    "SELECT * FROM users WHERE unique_id = ?",
    [unique_id]
  );

  if (users.length === 0) {
    return res
      .status(200)
      .json({ status: "Failed", message: "User not found" });
  }

  const [navigation] = await connection.query(
    'SELECT * FROM `app-navigation` WHERE user_type = "Both" OR user_type = "' +
      users[0].user_type +
      '"'
  );

  if (navigation.length === 0) {
    return res.status(422).json({ status: "fail", error: "Not Found" });
  }

  async function getNavigation() {
    const navigationTree = await createTree(navigation);
    return res
      .status(200)
      .json({ status: "success", statuscode: "01", data: navigationTree });
  }
  await getNavigation();
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

router.get("/fetch-app-navigation", TokenAuth, async (req, res) => {
  const connection = await poolPromise().getConnection();

  if (req.users.package_id === null) {
    return res.status(404).json({ message: "Package id not found" });
  }

  try {
    
    const [services] = await connection.query(
      "SELECT * FROM services_manager WHERE user_type = ? OR user_type = 'Both' AND status='Enable'",
      [req.users.user_type]
    );
    console.log(services,req.users.user_type,"req.users.user_type");
    const tree = createTree(services);
    res.json({
      status: "success",
      statuscode: "01",
      data: tree,
    });
  } catch (error) {
    console.log("Error:", error);
    res.status(422).json({ status: "fail", message: "Something went wrong!" });
  } finally {
    await connection.release();
  }
});

router.get("/myservice", TokenAuth, async (req, res) => {
  const connection = await poolPromise().getConnection();

  if (req.users.package_id === null) {
    return res.status(404).json({ message: "Package id not found" });
  }

  try {
    const [results] = await connection.query(
      "SELECT * FROM users_services WHERE customer_id = ? AND packages_id = ? AND status='Enable'",
      [req.users.customer_id, req.users.package_id]
    );
    const serviceIdArray = results.map((item) => item.service_id);
    // console.log(serviceIdArray);

    const [services] = await connection.query(
      "SELECT * FROM services_manager WHERE id IN (?) AND status='Enable'",
      [serviceIdArray]
    );
    // console.log(services);
    const tree = createTree(services);
    res.json({
      status: "success",
      statuscode: "01",
      data: tree,
    });
  } catch (error) {
    console.log("Error:", error);
    res.status(422).json({ status: "fail", message: "Something went wrong!" });
  } finally {
    await connection.release();
  }
});

router.get("/get-profile", TokenAuth, async (req, res) => {
  const { unique_id } = req.users;

  const connection = await poolPromise().getConnection();

  const [userstable] = await connection.query(
    "SELECT name, mobile, profile_photo, email_id FROM users WHERE unique_id = ?",
    [unique_id]
  );

  if (userstable.length === 0) {
    await connection.release();
    return res
      .status(422)
      .json({ status: "fail", message: "No Merchant is found" });
  }

  var profileimg;
  if (
    userstable[0].profile_photo !== "" &&
    userstable[0].profile_photo !== null
  ) {
    profileimg =
      `${process.env.BASE_URL}/assets/userdocs/` + userstable[0].profile_photo;
  } else {
    profileimg = `${process.env.BASE_URL}/assets/userdocs/default-user.png`;
  }

  const [profiletable] = await connection.query(
    "SELECT about_me, status FROM profile WHERE unique_id = ?",
    [unique_id]
  );

  const user = {
    Photo: profileimg,
    "KYC_Status ": profiletable[0].status,
    name: userstable[0].name,
    mobile_no: userstable[0].mobile,
    "email_id ": userstable[0].email_id,
    about_me: profiletable[0].about_me,
  };

  await connection.release();
  return res.json(user);
});

//added DATE_FORMAT(date_of_birth, "%d-%m-%Y")
router.get("/get-profile-details", TokenAuth, async (req, res) => {
  const { unique_id } = req.users;

  const connection = await poolPromise().getConnection();

  const [userstable] = await connection.query(
    "SELECT name FROM users WHERE unique_id = ?",
    [unique_id]
  );

  if (userstable.length === 0) {
    connection.release();
    return res
      .status(422)
      .json({ status: "fail", message: "No Merchant is found" });
  }

  const [profiletable] = await connection.query( //added DATE_FORMAT(date_of_birth, "%d-%m-%Y")
    `SELECT father_or_spousename,DATE_FORMAT(date_of_birth, "%d-%m-%Y") AS date_of_birth, gender, married, occupation, pan_no, aadhar_no, address FROM profile WHERE unique_id = ? `,
    [unique_id]
  );

  const userdetails = {
    name: userstable[0].name,
    father_or_spousename: profiletable[0].father_or_spousename,
    date_of_birth: profiletable[0].date_of_birth,
    gender: profiletable[0].gender,
    married: profiletable[0].married,
    occupation: profiletable[0].occupation,
    annual_income: profiletable[0].annual_income,
    pan_no: profiletable[0].pan_no,
    aadhar_no: profiletable[0].aadhar_no,
    address: profiletable[0].address,
  };

  connection.release();
  return res
    .status(200)
    .json({ status: "success", statuscode: "01", userdetails });
});

router.post("/update-about-me", TokenAuth, async (req, res) => {
  const { unique_id } = req.users;
  const { aboutus } = req.body;

  const connection = await poolPromise().getConnection();

  const sql = "UPDATE profile SET about_me = ? WHERE unique_id = ?";
  const values = [aboutus, unique_id];

  const [result] = await connection.query(sql, values);
  const affectedRows = result.affectedRows;

  if (affectedRows === 0) {
    await connection.release();
    return res
      .status(422)
      .json({ status: "fail", message: "Unable to update about us" });
  } else {
    await connection.release();
    return res.json({
      status: "success",
      message: "about us updated successfully",
    });
  }
});

router.post("/get-wallet-summary", TokenAuth, async (req, res) => {
  const { from_date, to_date, page, limit } = req.body;

  if (!from_date || !to_date || !page || !limit) {
    return res
      .status(404)
      .json({ message: "Requried from_date, to_date, page, limit" });
  }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { unique_id } = req.users;
  let query;
  let values;
  const connection = await poolPromise().getConnection();
 
  try{
    if (from_date && to_date) {
      query = `SELECT tran_id, type, amount, status, description, closing_balance, tran_at FROM walletsummary WHERE unique_id = ? AND tran_at BETWEEN ? AND ? ORDER BY tran_at DESC LIMIT ?, ?`;
      values = [
        unique_id,
        from_date + " 00:00:00",
        to_date + " 23:59:59",
        offset,
        parseInt(limit),
      ];
    } else {
      query = `SELECT tran_id, type, amount, status, description, closing_balance, tran_at FROM walletsummary WHERE unique_id = ? ORDER BY tran_at DESC  LIMIT ?, ?`;
      values = [unique_id, offset, parseInt(limit)];
    }
  
    const [results] = await connection.query(query, values);
  
    if (results.length > 0) {
      const formattedResults = results.map((result) => {
        const utcTimestamp = result.tran_at;
        const localDate = moment
          .utc(utcTimestamp)
          .local()
          .format("YYYY-MM-DD HH:mm:ss");
        return {
          ...result,
          tran_at: localDate,
        };
      });
  
      return res.status(200).json({
        status: "success",
        statuscode: "1",
        results: formattedResults,
      });
    } else {
      return res.status(200).json({
        status: "fail",
        statuscode: "0",
        message: "History is not available.",
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

 
});

router.get("/get-tpin-status", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const { unique_id } = req.users;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please Provide API KEY." });
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
      const sql1 = "SELECT tpin FROM users WHERE unique_id = ?";
      const value1 = [unique_id];
      const [tpinstatus] = await connection.query(sql1, value1);
      const tpinStatus = tpinstatus[0].tpin;
  
      if (tpinStatus) {
        return res.json({
          status: "success",
          statusCode: "1",
          message: "Tpin is available.",
        });
      } else {
        return res.json({
          status: "success",
          statusCode: "0",
          message: "Tpin is not available.",
        });
      }
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

router.post("/setpin", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const { unique_id } = req.users;
  const { tpin } = req.body;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide apikey" });
  }
  const connection = await poolPromise().getConnection();
  
  try{
    if (isNumeric(tpin)) {
      if (tpin.length === 6) {
  
        const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
        const value = [apikey];
        const [fetchedKey] = await connection.query(sql, value);
  
        if (fetchedKey.length === 0) {
          return res
            .status(422)
            .json({ status: "fail", message: "INVALID API KEY." });
        } else {
          const sql1 = "SELECT tpin FROM users WHERE unique_id = ?";
          const value1 = [unique_id];
          const [getTpin] = await connection.query(sql1, value1);
          const tpinStatus = getTpin[0].tpin;
  
          if (tpinStatus === null) {
            const [updatetpin] = await connection.query(
              "UPDATE users SET tpin = ? WHERE unique_id = ?",
              [tpin, unique_id]
            );
  
            return res.json({
              status: "success",
              message: "Successfully set transfer pin.",
            });
          } else {
            return res.status(422).json({
              status: "fail",
              message: "Transfer Pin is already set.",
            });
          }
        }
      } else {
        return res.status(422).json({
          status: "fail",
          message: "TPIN must be exactly 6 characters long.",
        });
      }
    } else {
      return res.status(422).json({
        status: "fail",
        message: "TPIN must contain only numeric characters.",
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

});

router.post("/change-tpin", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const { unique_id } = req.users;
  const { tpin, ctpin, oldPin } = req.body;

  if (!tpin || !ctpin) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide Transfer Pin" });
  }

  if (tpin !== ctpin) {
    return res
      .status(422)
      .json({ status: "fail", message: "Transfer Pin & Confirm Pin mismatch" });
  }
  const connection = await poolPromise().getConnection();

  try{
    if (isNumeric(tpin)) {

      const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
      const value = [apikey];
      const [fetchedKey] = await connection.query(sql, value);
  
      if (fetchedKey.length === 0) {
        return res
          .status(422)
          .json({ status: "fail", message: "INVALID API KEY." });
      } else {
        const sql1 = "SELECT tpin FROM users WHERE unique_id = ?";
        const value1 = [unique_id];
        const [getTpin] = await connection.query(sql1, value1);
  
        if (getTpin[0].tpin === JSON.parse(oldPin)) {
          const [updatetpin] = await connection.query(
            "UPDATE users SET tpin = ? WHERE unique_id = ?",
            [tpin, unique_id]
          );
  
          return res.json({
            status: "success",
            message: "Successfully set transfer pin.",
          });
        } else {
          return res
            .status(422)
            .json({ status: "fail", message: "Transfer pin is not matched." });
        }
      }
    } else {
      return res.status(422).json({
        status: "fail",
        message: "Value contains non-numeric characters",
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

});

router.post("/update_kyc", TokenAuth, async (req, res) => {
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

  try{
    const [profilestatus] = await connection.query(
      "SELECT status FROM profile WHERE unique_id = ?",
      [unique_id]
    );
    const userStatus = profilestatus[0].status;
  
    if (userStatus === "KYC-Not Submitted" || userStatus === "KYC-Rejected") {
      const [updateuse] = await connection.query(
        "UPDATE users SET name = ?, email_id = ? WHERE unique_id = ?",
        [name, email_id, unique_id]
      );
  
      if (updateuse.affectedRows === 1) {
        const [update] = await connection.query(
          "UPDATE profile SET father_or_spousename = ?, date_of_birth = ?, gender = ?, married = ?, anual_income = ?, pan_no = ?, aadhar_no = ?, address = ?, occupation = ? WHERE unique_id = ?",
          [
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
          ]
        );
  
        if (update.affectedRows === 1) {
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
  "/update_kyc_document",
  TokenAuth,
  upload.fields([
    { name: "pan_front", maxCount: 1 },
    { name: "aadhar_front", maxCount: 1 },
    { name: "aadhar_back", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  async (req, res) => {
    const { unique_id } = req.users;
    var{pan_front,aadhar_front,aadhar_back,photo} = req.files
    console.log("req.files",pan_front,aadhar_front,aadhar_back,photo);

    const panFront = pan_front === undefined ? undefined: pan_front[0];
    const aadharFront = aadhar_front === undefined ? undefined: aadhar_front[0] ;
    const aadharBack = aadhar_back === undefined ? undefined: aadhar_back[0] ;
     photo = photo === undefined ? undefined: photo[0] ;

    // const panFront = req.files["pan_front"][0] ;
    // const aadharFront = req.files["aadhar_front"][0] ;
    // const aadharBack = req.files["aadhar_back"][0] ;
    // const photo = req.files["photo"][0] ;

    if (!panFront || !aadharFront || !aadharBack || !photo) {
      return res.status(404).json({ message: "Requried PAN Aadhaar Photo" }); 
    }
    const connection = await poolPromise().getConnection();

    try {
      const [profilestatus] = await connection.query(
        "SELECT status FROM profile WHERE unique_id = ?",
        [unique_id]
      );
      const userStatus = profilestatus[0].status;

      if (userStatus === "KYC-Not Submitted" || userStatus === "KYC-Rejected") {
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

        const [update] = await connection.query(sql, values);

        if (update.affectedRows === 1) {
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
      console.error("Error:", error);
      return res.status(422).json({ status: "fail", error: error });
    } finally {
      await connection.release();
    }
  }
);

router.post(
  "/update_profile_photo",
  TokenAuth,
  uploadImage.single("profile_photo"),
  async (req, res) => {
    const { unique_id } = req.users;
    const file = req.file;
    const connection = await poolPromise().getConnection();

    try{
      if (file === undefined) {
        return res
          .status(422)
          .json({ status: "fail", message: "No image file found" });
      }
      const filename = file.filename;
      const sql = "UPDATE users SET profile_photo = ? WHERE unique_id = ?";
      const value = [filename, unique_id];
      const [result] = await connection.query(sql, value);
      const affectedRows = result.affectedRows;
      if (affectedRows === 0) {
        return res.status(422).json({
          status: "fail",
          message: "Unable to update profile photo",
        });
      } else {
        return res.json({
          status: "success",
          message: "Profile photo updated successfully",
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

router.post("/redeem-voucher", TokenAuth, async (req, res) => {
  // var { apiKey, token, app_version, app_id } = req.headers;
  var unique_id = req.users.unique_id;

  //(if Passing device Id then passing devices type. If passing mac id then OS)

  const {
    voucher_code,
    ip_address,
    coordinates,
    device_Id,//remove pending
    mac_id, //==device_Id
    device_type,//os
  } = req.body;
 console.log( "voucher_code",voucher_code,
    ip_address,
    coordinates,
    // device_Id,
    mac_id,
    device_type)
  const redeem_at = Date.now().toString();
  if (
    !voucher_code ||
    !ip_address ||
    !coordinates ||
    // !device_Id ||
    !mac_id ||
    !device_type
  ) {
    return res.status(404).json({
      statuscode: "2",
      status: false,
      message: "All value required",
    });
  }

  const connection = await poolPromise().getConnection();

  try{
    const [users] = await connection.query(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );
  
    if (users.length === 0) {
      return res
        .status(200)
        .json({ status: "Failed", message: "User not found" });
    }
  
    const [wallet] = await connection.execute(
      "SELECT * FROM wallet WHERE unique_id = ?",
      [unique_id]
    );
  
    if (mac_id === users[0].mac_id) {
  
      const [voucher] = await connection.query(
        "SELECT * FROM voucher WHERE voucher_code = ?", //doubt status Active
        [voucher_code]
      );
      if (voucher.length === 0) {
        return res.status(404).json({ 
          "status": false,
          "statuscode": "2",
          "message": "Invalid Voucher" });
      }
      //console.log(voucher,"voucher",voucher[0].expiry,"voucher.expiry", typeof(voucher.expiry),typeof(Date.now()),voucher[0].status === 'Redeem',voucher[0].status)
      
      // Date.now() > Number(voucher[0].expiry means voucher expired or  voucher[0].status === 'Redeem'
      if(Date.now() > Number(voucher[0].expiry) || voucher[0].status === 'Redeem' || voucher[0].status === 'Expired'){
  
       if(voucher[0].status !== 'Redeem'){
        const [updatevoucher] = await connection.query(
          "UPDATE voucher SET  status = ? WHERE voucher_code = ?",
          [
            "Expired"
          ]
        ); 
            return res.status(404).json({
              "status": false,
              "statuscode": "2",
              "message": `Voucher is Already Expired`
              });
       } 
        return res.status(404).json({
          "status": false,
          "statuscode": "2",
          "message": `Voucher is Already ${voucher[0].status}`
      });
  
      }
  
      
      const [updatevoucher] = await connection.query(
        "UPDATE voucher SET redeem_at = ?, status = ?, device_id = ?, os = ?, coordinates= ?, ip_address = ? WHERE voucher_code = ?",
        [
          redeem_at,
          "Redeem",
          // device_Id = mac_id
          mac_id,
          device_type,
          coordinates,
          ip_address,
          voucher_code,
        ]
      );
  
      let amount = wallet[0].wallet + voucher[0].amount;
  
      let [[max_tran_id]] = await connection.query(
        "SELECT MAX(`tran_id`) AS max_tran_id FROM walletsummary"
      );
      var tran_id = Number(max_tran_id.max_tran_id) + 0;
      tran_id = Number(tran_id) + 1;
  
      let description = {
        voucher_id: voucher[0].voucher_id,
        amount: voucher[0].amount,
        status: voucher[0].status,
      };
  
      const [walletsummary] = await connection.query(
        "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          unique_id,
          tran_id,
          "CR",
          voucher[0].amount,
          "Success",
          JSON.stringify(description),
          amount,
        ]
      );
        //added UPDATE wallet balances
      await connection.query(
        "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
        [amount, unique_id]
      );
      
  
      return res.status(200).json({
        statuscode: "01",
        status: "Success",
        message: `Voucher Redeem Successfully, Balances ${amount}`,// changed 0 to amount
      });
    } else {
  
     // changed res { message: "Mac id not matched!" } 
      return res.status(200).json({ 
        "status": false,
        "statuscode": "2",
        "message": "Token expired"
    }); 
    }
  
    // console.log(users[0].customer_id);
    // console.log(users[0].user_type);
    // console.log(users[0].coordinates);
    // console.log(users[0].device_Id);
    // console.log(users[0].os);
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

// Inter Group Transfer

router.post("/Fetch-Users", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  const { unique_id } = req.users;
  const { mobile_number } = req.body;

  if (!apikey) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide apikey" });
  }
  if (!mobile_number) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide mobile number" });
  }
  const connection = await poolPromise().getConnection();
  
  try{
    if (isNumeric(mobile_number)) {
      if (String(mobile_number).length === 10) {
  
        const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
        const value = [apikey];
        const [fetchedKey] = await connection.query(sql, value);
  
        if (fetchedKey.length === 0) {
          return res
            .status(422)
            .json({ status: "fail", message: "INVALID API KEY." });

        } else {

          const key = Date.now();
          const sql1 = "SELECT * FROM users WHERE unique_id = ?";
          const value1 = [unique_id];
          const [sender] = await connection.query(sql1, value1);
          console.log("sender",sender,"sender")
          const sql2 = "SELECT * FROM users WHERE mobile = ?";
          const value2 = [mobile_number];
          const [receiver] = await connection.query(sql2, value2);
          console.log("receiver",receiver,"receiver")
  
          if (receiver.length > 0 && sender[0].user_type === "Merchant" || (receiver[0].user_type !== "Merchant" && sender[0].user_type === "User" )) {
            const receiver_unique_id = receiver[0].unique_id;
            const receiver_name = receiver[0].name;
            const [results] = await connection.query(
              "SELECT MAX(`tnxid`) as tnxid FROM intergroup_transfer"
            );
    
            var tran_id_ = Number(results[0].tnxid) || 0;
            var tnxid = tran_id_ + 1
            const [intergroup_transfer2] = await connection.query(
              "INSERT INTO intergroup_transfer (`tnxid`,`sender_unique_id`, `receiver_unique_id`, `receiver_name`,`key`,`status`) VALUES (?, ?, ?, ?, ?, ?)",
              [
                tnxid,
                unique_id,
                receiver_unique_id,
                receiver_name,
                key,
                "Search",
              ]
            );
  
            return res.status(200).json({
              statuscode: "1",
              status: "success",
              data: {key, receiver_name}
            });

          } else {
            return res.status(422).json({
              status: "Failed",
              message: "users data not found.",
            });
          }
        }
      } else {
        return res.status(422).json({
          status: "Failed",
          message: "mobile number must be exactly 10 characters long.",
        });
      }
    } else {
      return res.status(422).json({
        status: "Failed",
        message: "mobile number must contain only numeric characters.",
      });
    }
  }catch (error) {
    console.error(error);
    return res.status(500).json({
    status: "Failed",
    statuscode: "02",
    message: "Failed to create intergroup_transfer",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}

});

router.post("/Intergroup-transfer", TokenAuth, async (req, res) => {
  const apikey = req.headers.apikey;
  // const { unique_id } = req.users;
  const { order_id, Key, Amount } = req.body; //pending  order_id unique
 console.log("Key1703590261799",!order_id||!Key||!Amount)
  if (!apikey) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide apikey" });
  }
  const connection = await poolPromise().getConnection();
  
  try{

    if (!order_id || !Key || !Amount) {
      return res.status(422).json({
        status: "Failed",
        message: "Please provide order_id, Key and Amount ",
      }); 
    } else {
      const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
      const value = [apikey];
      const [fetchedKey] = await connection.query(sql, value);
      if (fetchedKey.length === 0) {
        return res
        .status(422)
        .json({ status: "fail", message: "INVALID API KEY." });
      } else {
        const sql4 = "SELECT * FROM intergroup_transfer WHERE order_id = ?";
        const value4 = [order_id];
        const [intergroup_transfer4] = await connection.query(sql4, value4);
          const sql3 = "SELECT * FROM intergroup_transfer WHERE `key` = ?";
          const value3 = [Key];
          const [intergroup_transfer1] = await connection.query(sql3, value3);
          
          if(intergroup_transfer1.length > 0 && intergroup_transfer4.length === 0 && intergroup_transfer1[0].status !== "Success"){
              var sender_unique_id = intergroup_transfer1[0].sender_unique_id;
              var receiver_unique_id = intergroup_transfer1[0].receiver_unique_id;
              //sender 
              const sql1 = "SELECT * FROM users WHERE unique_id = ?";
              const value1 = [sender_unique_id];
              const [sender] = await connection.query(sql1, value1);
              console.log("sender",sender,"sender");
              const sendcustomer_id = sender[0].customer_id;
              const sender_mobile = sender[0].mobile;
              const sender_name = sender[0].name;

              //receiver
              const sql2 = "SELECT * FROM users WHERE unique_id = ?";
              const value2 = [receiver_unique_id];
              const [receiver] = await connection.query(sql2, value2);
              console.log("receiver",receiver,"receiver")
              const customer_id = String(receiver[0].customer_id);
              const mobile = receiver[0].mobile;
              const receiver_name = receiver[0].name;

              // generate transaction_at
              const transaction_id  = Date.now().toString();

              const [users_services] = await connection.query(
                "SELECT * FROM users_services WHERE customer_id = ? and service_id = ?",
                [sendcustomer_id,4]
              );
                console.log("users_services",users_services,"users_services");

              const [wallet] = await connection.query(
                "SELECT * FROM wallet WHERE unique_id = ?",
                [sender_unique_id]
              );
              if (wallet[0].status === "Disable"){
                return res.status(422).json({
                  status: "Failed",
                  message: "wallet Status is Disable",
                });
              }
              if (users_services[0].status === "Disable"){
                return res.status(422).json({
                  status: "Failed",
                  message: "users_services Status is Disable",
                });
              }
      

          if ( sender[0].user_type === "Merchant" || (receiver[0].user_type !== "Merchant" && sender[0].user_type === "User" ) ) {

            if ( Number(wallet[0].wallet) >= Number(Amount)){

              const [sende_wallet] = await connection.query( // doubt which wallet
                "UPDATE wallet SET wallet = wallet - ? WHERE unique_id = ? ",
                [Number(Amount), sender_unique_id]
              );

              if(sende_wallet.affectedRows === 1){
                // walletsummary creation 
                const [results] = await connection.query(
                  "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
                );
        
                var tran_id_ = results[0].max_tran_id || 0;
                var tran_id_w_ = tran_id_ + 1;
                var description_ = `Rs.${Number(Amount)}/- Successful Transfer to ${receiver_name} | ${mobile}`;
        
                 //fetching sender_clo_bal from wallet

                 var [sender_wallet] = await connection.query(
                  "SELECT * FROM wallet WHERE unique_id = ?",
                  [sender_unique_id]
                );

                var sender_wallet = sender_wallet[0].wallet
        
                await connection.query(
                  "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [
                    sender_unique_id,
                    tran_id_w_,
                    "DR",
                    Number(Amount),
                    "Success",
                    description_,
                    sender_wallet,
                  ]
                );
                const [receiver_wallet] = await connection.query(
                  "UPDATE wallet SET wallet = wallet + ? WHERE unique_id = ? ",
                  [Number(Amount), receiver_unique_id]
                );

                if(receiver_wallet.affectedRows === 1){

                  // walletsummary creation 
                const [results] = await connection.query(
                  "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
                );
        
                var tran_id_ = results[0].max_tran_id || 0;
                var tran_id_w_ = tran_id_ + 1;
                var description_ = `Rs.${Number(Amount)}/ Receive in your Wallet Send from ${sender_mobile} | ${sender_name}`;
        
                

                  //fetching receiver_clo_bal from wallet
                  
                  const [receiver_wallet] = await connection.query(
                    "SELECT * FROM wallet WHERE unique_id = ?",
                    [receiver_unique_id]
                  );
                 

                var receiver_wallett = receiver_wallet[0].wallet
        
                await connection.query(
                  "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [
                    receiver_unique_id,
                    tran_id_w_,
                    "CR",
                    Number(Amount),
                    "Success",
                    description_,
                    receiver_wallett,
                  ]
                );

                 
                 
                  const [sende_wallet] = await connection.query(
                    "UPDATE intergroup_transfer SET order_id = ?, amount = ?, transaction_at = ?, sender_clo_bal = ?, receiver_clo_bal = ?, status = ? WHERE `key` = ? ",
                    [order_id, Number(Amount), transaction_id, sender_wallet, receiver_wallet[0].wallet,"Success", Key]
                  );

                  if(sende_wallet.affectedRows === 1){
                    return res.status(200).json({
                      statuscode: "1",
                      status: "success",
                      data: { customer_id: `XXXXX${customer_id.slice(-4)}`, mobile:mobile, receiver_name: receiver_name, transfer_amount: Number(Amount), Transaction_id:transaction_id, sender_customer_id:sendcustomer_id , order_id:order_id ,debit : Number(Amount) }
                    });
                  }else{
                    return res.status(422).json({
                      status: "Failed",
                      message: "intergroup_transfer updates failed",
                    });
      
                  }
                 

                }else{
                  return res.status(422).json({
                    status: "Failed",
                    message: "receiver wallet updates failed",
                  });
    
                }

              } else{
                return res.status(422).json({
                  status: "Failed",
                  message: "sende_wallet updates failed",
                });
  
              }
              
            } else{
              return res.status(422).json({
                status: "Failed",
                message: "Insufficient funds",
              });

            }

            } else {
              return res.status(422).json({
                status: "Failed",
                message: "Sender is User and Receiver is a merchant.",
              });
            }
        } else {
            return res.status(422).json({
              status: "Failed",
              message: "users data not found or order id is already exists",
            });
          }
        
      }
      
    }

  }catch (error) {
    console.error(error);
    return res.status(500).json({
    status: "Failed",
    statuscode: "02",
    message: "Failed to create intergroup_transfer",
  });
}finally {
  if (connection) {
    await connection.release();
  }
}

});

//Inter Group Transfer


function createTree(data) {
  const tree = [];
  const nodes = {};
  data.forEach((item) => {
    nodes[item.id] = { ...item, children: [] };
  });
  Object.values(nodes).forEach((node) => {
    if (node.parent_id !== 0) {
      const parent = nodes[node.parent_id];
      if (parent) {
        parent.children.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  return tree;
}

function isNumeric(value) {
  const regex = /^[0-9]+$/;
  return regex.test(value);
}

module.exports = router;
