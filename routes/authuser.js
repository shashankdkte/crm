const express = require("express");
const router = express.Router();
const md5 = require("md5");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const poolPromise = require("../util/connectionPromise");
const {smsfunction} = require("../globalfunction/smsfunction.js");
const SALT = process.env.SALT.toString();
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const { savevirtualaccount } = require("../globalfunction/savevirtualaccount");
const { isEmpty } = require("lodash");

router.post("/search-user", async (req, res) => {
  let connection;
  try{
    connection = await poolPromise().getConnection();
    var { mobile, mac_id, coordinates } = req.body;
    const phoneNumber = mobile;
    const isValid = validateMobileNumber(phoneNumber);
    const key = uuidv4(mobile);
    const secretToken = uuidv4();
    if (!isValid) {
      return res
        .status(422)
        .json({ status: "fail", message: "Invalid mobile number" });
    }
    const [[savedmerchant]] = await connection.query(
      "SELECT * FROM users WHERE mobile = ?",
      [mobile]
    );

    if (!savedmerchant) {
      const [[getcustomerid]] = await connection.query(
        "SELECT MAX(`customer_id`) as max_customer_id FROM users"
      );
      let customerid = "231632601";
      if (getcustomerid?.max_customer_id) {
        customerid = getcustomerid.max_customer_id + 1;
      }
      var otp = Math.floor(1000 + Math.random() * 9000);
      let saltedOTP = SALT.concat(otp);
      var hashedOTP = md5(saltedOTP);

  
      const currentDate = new Date();
      const futureDate = new Date(currentDate.getTime());
      futureDate.setDate(currentDate.getDate());
      const formattedDate = futureDate.toISOString().substr(0, 10); 
  
      var userdata = {
        unique_id: key,
        user_type: "User",
        customer_id: customerid,
        mobile: mobile,
        otp: hashedOTP,
        coordinates: coordinates,
        created_date: formattedDate,
      };

  
      await connection.query("INSERT INTO users SET ?", [userdata]);

    //sms_templete
    const var1 = "<%23> ";
    const var3 = " 3 min ";
    const functions = "send_otp";
    const sql = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
    const value1 = [functions];
    const [smstemplate] = await connection.query(sql, value1);
    const template_id = smstemplate[0].template_id;
    const templates = smstemplate[0].templates;
    console.log(templates,smstemplate,"smstemplate")
    var message = templates.replace('#VAR1#', var1);
    var message1 = message.replace('#VAR2#', otp);
    var message2 = message1.replace('#VAR3#', var3);

    //sms_templete

      smsfunction(mobile, template_id, message2 );
      return res.json({
        status: "send otp",
        statuscode: "05",
        Status: "Success",
        unique_id: key,
        message: "With OTP Onboard This User",
      });
    } else {
      await connection.query(
        "UPDATE users SET secretToken = ? WHERE unique_id =  ? ",
        [secretToken, savedmerchant.unique_id]
      );
  
      const unique_id = savedmerchant.unique_id;
      const status = savedmerchant.status;
      const password = savedmerchant.password;
      const mobile = savedmerchant.mobile;
      const user_type = savedmerchant.user_type;
      const deviceId = savedmerchant.mac_id;
      const token = jwt.sign(
        {
          id: unique_id,
          secret: secretToken,
          mac_id: deviceId,
          mobile: mobile,
        },
        process.env.JWT_KEYS
      );
  
      if (JSON.parse(status) === 1) {
        const limiting_token = jwt.sign({ id: unique_id }, process.env.JWT_KEYS);
        return res.json({
          status: "Success",
          statuscode: "06",
          token: limiting_token,
          message: "Onboard User Data",
        });
      } else if (JSON.parse(status) === 0) {
        var otp = Math.floor(1000 + Math.random() * 9000);
        let saltedOTP = SALT.concat(otp);
        var hashedOTP = md5(saltedOTP);

        await connection.query(
          "UPDATE users SET otp = ? WHERE users.mobile = ?",
          [hashedOTP, mobile]
        );

              //sms_templete
        const var1 = "<%23> ";
        const var3 = " 3 min ";
        const functions = "send_otp";
        const sql = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
        const value1 = [functions];
        const [smstemplate] = await connection.query(sql, value1);
        const template_id = smstemplate[0].template_id;
        const templates = smstemplate[0].templates;
        console.log(templates,smstemplate,"smstemplate")
        var message = templates.replace('#VAR1#', var1);
        var message1 = message.replace('#VAR2#', otp);
        var message2 = message1.replace('#VAR3#', var3);

        //sms_templete

        smsfunction(mobile, template_id, message2 );
        return res.json({
          status: "send otp",
          statuscode: "05",
          Status: "Success",
          unique_id: unique_id,
          message: "With OTP Onboard This User",
        });
      } else if (JSON.parse(status) === 2) {
        const limiting_token = jwt.sign(
          { id: unique_id, secret: secretToken },
          process.env.JWT_KEYS
        );
        return res.json({
          status: "Success",
          statuscode: "07",
          token: limiting_token,
          message: "Onboarding Business Personal Details",
        });
      } else if (JSON.parse(status) === 3) {
        if (password === "" || password === null) {
          if (deviceId !== mac_id || mac_id === "" || deviceId === null) {
            var otp = Math.floor(1000 + Math.random() * 9000);
            let saltedOTP = SALT.concat(otp);
            var hashedOTP = md5(saltedOTP);

  
            await connection.query(`UPDATE users SET otp = ? WHERE mobile = ?`, [
              hashedOTP,
              mobile,
            ]);


            //sms_templete
            const var1 = "<%23> ";
            const var3 = " 3 min ";
            const functions = "send_otp";
            const sql = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
            const value1 = [functions];
            const [smstemplate] = await connection.query(sql, value1);
            const template_id = smstemplate[0].template_id;
            const templates = smstemplate[0].templates;
            console.log(templates,smstemplate,"smstemplate")
            var message = templates.replace('#VAR1#', var1);
            var message1 = message.replace('#VAR2#', otp);
            var message2 = message1.replace('#VAR3#', var3);

            //sms_templete

            smsfunction(mobile, template_id, message2 );
            return res.json({
              status: "send otp",
              statuscode: "02",
              message: "OTP Successfully Send to Registered Mobile ",
            });
          } else {
            const limiting_token = jwt.sign(
              { id: unique_id, secret: secretToken },
              process.env.JWT_KEYS
            );
            return res.json({
              status: "set password",
              statuscode: "04",
              token: limiting_token,
              message: "Device Id Matched",
            });
          }
        } else {
          if (deviceId === mac_id) {
            const accountid = savedmerchant.unique_id;
            await connection.query(
              `UPDATE users SET coordinates = ?, secretToken= ? WHERE mobile = ?`,
              [coordinates, secretToken, mobile]
            );
            const [[fetchusername]] = await connection.query(
              "SELECT * FROM users WHERE unique_id = ?",
              [accountid]
            );
            const username = fetchusername.name;
            return res.json({
              status: "success",
              statuscode: "01",
              "User name": username,
              mobile,
              usertype: user_type,
              tpin_status: savedmerchant?.tpin == null ? "02" : "01",
              customer_id: savedmerchant?.customer_id,
              token,
            });
          } else {
            return res.json({
              status: "pending",
              message: "unlock with password and save devices details",
              statuscode: "03",
            });
          }
        }
      } else if (JSON.parse(status) === 4) {
        return res.json({
          status: "set password",
          statuscode: "04",
          token: token,
          message: "KYC Verification Pending",
        });
      } else if (JSON.parse(status) === 5) {
        return res.json({
          status: "set password",
          statuscode: "05",
          token: token,
          message: "status is Not Active",
        });
      } else if (JSON.parse(status) === 6) {
        return res.status(422).json({
          status: "Failed",
          statuscode: "2",
          message: " Your Account is Suspended Please Contact to Customer Care",
        });
      }
    }

  }catch (error) {
    console.log(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }

});

router.post("/saved_mac_id", async (req, res) => {
  const { otp, mobile, mac_id } = req.body;

  if (!otp || !mobile || !mac_id) {
    return res.status(404).json({
      statuscode: "2",
      status: false,
      message: "All value required",
    });
  }
  const apikey = req.headers.apikey;
  try {
    const connection = await poolPromise().getConnection();

    try {
      const [fetchedKey] = await connection.execute(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [apikey]
      );

      if (fetchedKey.length === 0) {
        connection.release();
        return res
          .status(422)
          .json({ status: "fail", message: "INVALID API KEY" });
      }

      let saltedOTP = SALT.concat(otp);
      var hashedOTP = md5(saltedOTP);

      const [savedmerchant] = await connection.execute(
        "SELECT * FROM users WHERE mobile = ?",
        [mobile]
      );

      if (isEmpty(savedmerchant)) {
        connection.release();
        return res.status(422).json({
          status: "fail",
          message: "No Merchant associated with the mobile number",
        });
      }

      const id = savedmerchant[0]?.unique_id;
      const mac_ids = savedmerchant[0]?.mac_id;
      const merchantMobile = savedmerchant[0]?.mobile;
      const Password = savedmerchant[0]?.password;
      const user_type = savedmerchant[0]?.user_type;
      const secretToken = savedmerchant[0]?.secretToken;

      if (hashedOTP === savedmerchant[0].otp) {
        const [updatemerchant] = await connection.execute(
          "UPDATE users SET mac_id = ? WHERE mobile = ?",
          [mac_id, merchantMobile]
        );

        if (updatemerchant.affectedRows === 0) {
          connection.release();
          return res
            .status(422)
            .json({ status: "fail", message: "Failed to update MAC ID" });
        }

        const limiting_token = jwt.sign(
          {
            id: id,
          },
          process.env.JWT_KEYS
        );
        connection.release();

        if (!Password) {
          return res.json({
            status: "set Password",
            statuscode: "04",
            message: "Set a password",
            token: limiting_token,
          });
        } else {
          const token = jwt.sign(
            {
              id: id,
              secret: secretToken,
              mac_id: mac_ids,
              mobile: merchantMobile,
            },
            process.env.JWT_KEYS
          );
          return res.json({
            status: "success",
            statuscode: "01",
            "usertype": user_type,
            tpin_status: savedmerchant[0]?.tpin == null ? "02" : "01",
            customer_id: savedmerchant[0]?.customer_id,
            token: token,
            message: "Login success, go to dashboard",
          });
        }
      } else {
        connection.release();
        return res.status(422).json({ status: "fail", message: "Invalid OTP" });
      }
    } catch (error) {
      connection.release();
      console.log(error.message);
      return res.status(422).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

router.post("/login-with-password", async (req, res) => {
  const { mobile, password } = req.body;
  const apikey = req.headers.apikey;

  if (!mobile || !password) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide all details" });
  }

  try {
    const connection = await poolPromise().getConnection();

    try {
      const [fetchedKey] = await connection.execute(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [apikey]
      );

      if (fetchedKey.length === 0) {
        connection.release();
        return res
          .status(422)
          .json({ status: "fail", message: "INVALID API KEY" });
      }

      const otp = Math.floor(1000 + Math.random() * 9000);
      let saltedOTP = SALT.concat(otp);
      var hashedOTP = md5(saltedOTP);

      const [savedUser] = await connection.execute(
        "SELECT password FROM users WHERE mobile = ?",
        [mobile]
      );

      if (savedUser.length === 0) {
        connection.release();
        return res.status(422).json({
          status: "fail",
          message: "Invalid Mobile number or password",
        });
      }

      const userPassword = savedUser[0].password;

      if (userPassword === password) {
        const [sent_otp] = await connection.execute(
          "UPDATE users SET otp = ? WHERE mobile = ?",
          [hashedOTP, mobile]
        );

        if (sent_otp.affectedRows === 0) {
          connection.release();
          return res.status(400).json({ status: "fail" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000);
        let saltedOTP = SALT.concat(otp);
        var hashedOTP = md5(saltedOTP);

        const [result] = await connection.execute(
          "UPDATE users SET otp = ? WHERE mobile = ?",
          [hashedOTP, mobile]
        );

        if (result.affectedRows === 0) {
          connection.release();
          return res.status(400).json({ status: "fail" });
        }

          //sms_templete
          const var1 = "<%23> ";
          const var3 = " 3 min ";
          const functions = "send_otp";
          const sql = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
          const value1 = [functions];
          const [smstemplate] = await connection.query(sql, value1);
          const template_id = smstemplate[0].template_id;
          const templates = smstemplate[0].templates;
          console.log(templates,smstemplate,"smstemplate")
          var message = templates.replace('#VAR1#', var1);
          var message1 = message.replace('#VAR2#', otp);
          var message2 = message1.replace('#VAR3#', var3);

          //sms_templete

        smsfunction(mobile, template_id, message2 );
        connection.release();

        return res.json({
          status: "save details",
          statuscode: "02",
          message: "Provide OTP for Login Validation.",
        });
      } else {
        connection.release();
        return res
          .status(422)
          .json({ status: "fail", message: "Invalid Password" });
      }
    } catch (error) {
      connection.release();
      console.log(error.message);
      return res.status(422).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

router.post("/set-password", async (req, res) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return res
      .status(422)
      .json({ status: false, statuscode: "2", error: "Unauthorization" });
  }
  const token = authorization.replace("Bearer ", "");
  jwt.verify(token, process.env.JWT_KEYS, async (err, payload) => {
    if (err) {
      return res.status(422).json({ error: err });
    }
    const { id } = payload;
    var accountid = id;

    const connection = await poolPromise().getConnection();
    const [fetchedUser] = await connection.execute(
      "SELECT * FROM users WHERE unique_id = ?",
      [accountid]
    );
    const mac_id = fetchedUser[0].mac_id;
    const mobile = fetchedUser[0].mobile;
    const usertype = fetchedUser[0].user_type;
    const apikey = req.headers.apikey;
    const { password, cpassword } = req.body;

    if (password !== cpassword) {
      return res.status(422).json({
        status: "fail",
        message: "Password and Confirm Password must be the same.",
      });
    }

    try {
      const [fetchedKey] = await connection.execute(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [apikey]
      );

      if (fetchedKey.length === 0) {
        connection.release();
        return res
          .status(422)
          .json({ status: "fail", message: "INVALID API KEY" });
      }

      const [fetchedUser] = await connection.execute(
        "SELECT * FROM users WHERE unique_id = ?",
        [accountid]
      );
      const username = fetchedUser[0].name;
      const secretToken = fetchedUser[0].secretToken;

      const [updatePassword] = await connection.execute(
        "UPDATE users SET password = ? WHERE unique_id = ?",
        [password, accountid]
      );

      if (updatePassword.affectedRows === 0) {
        connection.release();
        return res.status(422).json({ status: "fail" });
      }

      const token = jwt.sign(
        {
          id: accountid,
          secret: secretToken,
          mac_id: mac_id,
          mobile: mobile,
        },
        process.env.JWT_KEYS
      );

      connection.release();
      return res.json({
        status: "success",
        statuscode: "01",
        "user name": username,
        "usertype": usertype,
        tpin_status: fetchedUser[0]?.tpin == null ? "02" : "01",
        customer_id: fetchedUser[0]?.customer_id,
        token: token,
        message: "Login success goes to dashboard",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(422).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
  });
});

router.post("/verify-otp", async (req, res) => {
  const { unique_id, otp, mac_id, password, usertype } = req.body;
  try {
    const connection = await poolPromise().getConnection();

    const [savedtranid] = await connection.execute(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );

    if (savedtranid.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }

    const user = savedtranid[0];
    const status = savedtranid[0].status;
    const mobile = user.mobile;
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);
    const limiting_token = jwt.sign(
      {
        id: unique_id,
        // mac_id: mac_id,
        // mobile: mobile,
      },
      process.env.JWT_KEYS
    );

    if (JSON.parse(status) === 0) {
      if (user.otp === hashedOTP) {
        const [sent_otp] = await connection.execute(
          "UPDATE users SET mac_id = ?, status = ?, password = ?, user_type = ? WHERE unique_id = ?",
          [mac_id, "1", password, usertype, unique_id]
        );

        if (sent_otp.affectedRows === 0) {
          connection.release();
          return res.status(400).json({ status: "fail" });
        }

        connection.release();
        return res.status(200).json({
          status: "success",
          statuscode: "06",
          token: limiting_token,
          message: "OTP verified go to login",
        });
      } else {
        connection.release();
        return res.status(422).json({ status: "fail", message: "Invalid OTP" });
      }
    } else {
      connection.release();
      return res
        .status(422)
        .json({ status: "fail", message: "Already verified your account" });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

router.post("/user-onbording", async (req, res) => {
  const secretToken = uuidv4();
  const { authorization } = req.headers;
  if (!authorization) {
    return res
      .status(422)
      .json({ status: false, statuscode: "2", error: "Unauthorization" });
  }
  const token = authorization.replace("Bearer ", "");
  jwt.verify(token, process.env.JWT_KEYS, async (err, payload) => {
    if (err) {
      return res.status(422).json({ error: err });
    }
    const { id } = payload;
    var unique_id = id;
    const {
      gender,
      date_of_birth,
      name,
      email_id,
      address,
      aadhar_no,
      pan_no,
    } = req.body;
    if (
      !unique_id ||
      !gender ||
      !date_of_birth ||
      !name ||
      !email_id ||
      !address
    ) {
      return res
        .status(404)
        .json({ status: "fail", message: "Invalid Values" });
    }
    try {
      const connection = await poolPromise().getConnection();

      const [savedtranid] = await connection.execute(
        "SELECT * FROM users WHERE unique_id = ?",
        [unique_id]
      );

      if (savedtranid.length === 0) {
        connection.release();
        return res
          .status(404)
          .json({ status: "fail", message: "User not found" });
      }

      const user = savedtranid[0];
      const status = savedtranid[0].status;
      const usertpe = savedtranid[0].user_type;
      const mac_id = user.mac_id;
      const mobile = user.mobile;
      // const secretToken = user.secretToken;
      var statuss = usertpe === "User" ? "3" : "2";
      let package = user.user_type == "Merchant" ? 2002 : 2001;

      const token = jwt.sign(
        {
          id: unique_id,
          secret: secretToken,
          mac_id: mac_id,
          mobile: mobile,
        },
        process.env.JWT_KEYS
      );

      const [scheme] = await connection.execute(
        "SELECT * FROM scheme WHERE package_id = ?",
        [package]
      );

      if (scheme.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ status: "package not found", error: err });
      }

      const currentDate = new Date();
      let futureDate = new Date(currentDate.getTime());
      futureDate.setDate(currentDate.getDate() + parseInt(scheme[0].duration));
      const formattedFutureDate = futureDate.toISOString().substr(0, 10);

      futureDate.setDate(currentDate.getDate() - parseInt(scheme[0].duration));
      const activedate = futureDate.toISOString().substr(0, 10);

      const randomOrderId = generateRandomOrderId();
      const schemeSummaryData = {
        order_id: randomOrderId,
        order_by: "",
        users_type: user.user_type,
        customer_id: user.customer_id,
        packid: package,
        packname: "",
        price: 0,
        gst: 0,
        total: 0,
        status: "Pending",
        validity: scheme[0].duration,
        activedate: activedate,
        expiredate: formattedFutureDate,
        tran_at: currentDate,
      };

      const [schemesummary] = await connection.query(
        "INSERT INTO schemesummary (order_id, order_by, users_type, customer_id, packid, packname, price, gst, total, status, validity, activedate, expiredate, tran_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        [
          schemeSummaryData.order_id,
          schemeSummaryData.order_by,
          schemeSummaryData.users_type,
          schemeSummaryData.customer_id,
          schemeSummaryData.packid,
          schemeSummaryData.packname,
          schemeSummaryData.price,
          schemeSummaryData.gst,
          schemeSummaryData.total,
          schemeSummaryData.status,
          schemeSummaryData.validity,
          schemeSummaryData.activedate,
          schemeSummaryData.expiredate,
          schemeSummaryData.tran_at,
        ]
      );

      const [sent_otp] = await connection.execute(
        "UPDATE users SET name = ?, email_id = ?, status = ?, expiry = ?, package_id = ?, secretToken = ? WHERE unique_id = ?",
        [
          name,
          email_id,
          statuss,
          formattedFutureDate,
          package,
          secretToken,
          unique_id,
        ]
      );

      const [saveddata] = await connection.execute(
        "SELECT * FROM profile WHERE unique_id = ?",
        [unique_id]
      );

      if (saveddata.length === 0) {
        var userdata = {
          unique_id: unique_id,
          gender: gender,
          date_of_birth: date_of_birth,
          address: JSON.stringify(address),
        };
        const [profile] = await connection.query(
          "INSERT INTO profile (unique_id, gender, date_of_birth, address, pan_no, aadhar_no) VALUES (?, ?, ?, ?, ?, ?)",
          [
            userdata.unique_id,
            userdata.gender,
            userdata.date_of_birth,
            userdata.address,
            pan_no,
            aadhar_no,
          ]
        );

        var userWallet = {
          unique_id: unique_id,
          wallet: 0,
          status: "Enable",
        };
        const [wallet] = await connection.query(
          "INSERT INTO wallet (unique_id, wallet, status) VALUES (?, ?, ?)",
          [userWallet.unique_id, userWallet.wallet, userWallet.status]
        );

        const [results] = await connection.execute(
          "SELECT * FROM users WHERE unique_id = ?",
          [unique_id]
        );
        const package_id = results[0].package_id;

        if (!package_id) {
          connection.release();
          return res
            .status(500)
            .json({ success: false, message: "Package ID not found" });
        }

        const serviceData = await getServiceWithPackages(package_id);

        if (!serviceData.length) {
          connection.release();
          return res.status(500).json({
            success: false,
            message: "No services found for this package",
          });
        }

        const userData = serviceData.map((item) => [
          user.customer_id,
          item.packages_id,
          item.service_id,
          item.status,
        ]);

        await insertUserServices(userData);

        if (statuss === "3") {
          connection.release();
          return res.status(200).json({
            status: "success",
            statuscode: "01",
            "User name": name,
            mobile,
            usertype: user.user_type,
            token,
          });
        } else {
          connection.release();
          return res.status(200).json({
            status: "success",
            statuscode: "07",
            message: "onboard Business Profile",
          });
        }
      } else {
        connection.release();
        return res.status(404).json({
          status: "fail",
          statuscode: "2",
          message: "already data updated",
        });
      }
    } catch (error) {
      console.log(error);
      return res.status(404).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
  });
});

async function getServiceWithPackages(package_id) {
  const connection = await poolPromise().getConnection();

  try {
    const [serviceData] = await connection.execute(
      "SELECT * FROM service_with_packages WHERE packages_id = ?",
      [package_id]
    );

    return serviceData;
  } finally {
    connection.release();
  }
}

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

router.post("/merchant-onbording", async (req, res) => {
  const secretToken = uuidv4();
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      return res
        .status(422)
        .json({ status: false, statuscode: "2", error: "Unauthorization" });
    }
    const token = authorization.replace("Bearer ", "");
    jwt.verify(token, process.env.JWT_KEYS, async (err, payload) => {
      if (err) {
        return res.status(422).json({ error: err });
      }
      const { id } = payload;
      var unique_id = id;

      const {
        entity_type,
        nature_of_business,
        legal_name,
        trade_name,
        pan_number,
        gst_no,
        udyam_number,
        date_of_registration,
        registration_no,
        address,
      } = req.body;
      
      
      if (!trade_name || !address || !pan_number) {
        return res.status(422).json({
          status: "fail",
          message: "Trade name,pan_number and address must be required.",
        });
      }

      const connection = await poolPromise().getConnection();

      const [savedtranid] = await connection.execute(
        "SELECT * FROM users WHERE unique_id = ?",
        [unique_id]
      );

      if (savedtranid.length === 0) {
        connection.release();
        return res
          .status(404)
          .json({ status: "fail", message: "User not found" });
      }

      const user = savedtranid[0];
      const usertpe = user.user_type;
      const mac_id = user.mac_id;
      const mobile = user.mobile;
      const customer_id = user.customer_id;
      const package_id = user.package_id;
      const service_id = "8";
      // const secretToken = user.secretToken;
      const statuss = usertpe === "Merchant" ? "3" : "2";
      const token = jwt.sign(
        {
          id: unique_id,
          secret: secretToken,
          mac_id: mac_id,
          mobile: mobile,
        },
        process.env.JWT_KEYS
      );

      const [sent_otp] = await connection.execute(
        "UPDATE users SET status = ?, secretToken = ? WHERE unique_id = ?",
        [statuss, secretToken, unique_id]
      );

      if (sent_otp.affectedRows === 0) {
        connection.release();
        return res.status(400).json({ status: "fail" });
      }

      const [saveddata] = await connection.execute(
        "SELECT * FROM business_profile WHERE unique_id = ?",
        [unique_id]
      );

      if (saveddata.length === 0) {
        var userdata = {
          unique_id: unique_id,
          entity_type: entity_type || "NULL",
          nature_of_business: nature_of_business || "NULL",
          legal_name: legal_name || "NULL",
          trade_name: trade_name,
          pan_number: pan_number,
          gst_no: gst_no || "NULL",
          udyam_number: udyam_number || "NULL",
          date_of_registration:
            date_of_registration ||
            moment.utc(new Date()).local().format("YYYY-MM-DD HH:mm:ss"),
          registration_no: registration_no || "NULL",
          address: JSON.stringify(address, replacerFunc()),
        };

        const [results] = await connection.query(
          "INSERT INTO business_profile SET ?",
          [userdata]
        );
        if (results.affectedRows === 0) {
          connection.release();
          return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        }

        const [users_services] = await connection.query(
          "SELECT * FROM users_services WHERE packages_id = ? AND customer_id = ? AND service_id = ?",
          [package_id, customer_id, service_id]
        );
          console.log(users_services,"users_services")
        if (users_services[0].status === "Enable") {
          savevirtualaccount(
            req,
            res,
            unique_id,
            trade_name,
            pan_number,
            address
          );
          if (statuss === "2") {
            return res.status(200).json({
              status: "success", 
              statuscode: "03",
              "User name": user.name,
              mobile,
              usertype: user.user_type,
              tpin_status: user.tpin == null ? "02" : "01",
              customer_id: user.customer_id,
              token,
            });
          } else {
            return res.status(200).json({
              status: "success",
              statuscode: "01",
              "User name": user.name,
              mobile,
              usertype: user.user_type,
              tpin_status: user.tpin == null ? "02" : "01",
              customer_id: user.customer_id,
              token,
            });
          }
        } else {
          return res.status(200).json({
            status: "success",
            statuscode: "01",
            "User name": user.name,
            mobile,
            usertype: user.user_type,
            tpin_status: user.tpin == null ? "02" : "01",
            customer_id: user.customer_id,
            virtual_account: "Not created!",
            token,
          });
        }
      } else {
        connection.release();
        return res.status(404).json({
          status: "fail",
          statuscode: "2",
          message: "Data already updated",
        });
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    var { mobile } = req.body;
    const connection = await poolPromise().getConnection();

    const [saveduser] = await connection.query(
      "SELECT * FROM users WHERE mobile = ?",
      [mobile]
    );

    if (saveduser.length === 0) {
      connection.release();
      return res.status(422).json({ status: "User not exists!" });
    }

    mobile = saveduser[0].mobile;

    // Find a suitable SMS template

    // Generate OTP
    var otp = Math.floor(1000 + Math.random() * 9000);
    let saltedOTP = SALT.concat(otp);
    var hashedOTP = md5(saltedOTP);

    // Update the user's OTP in the database
    const [updateResult] = await connection.query(
      "UPDATE users SET otp = ? WHERE mobile = ?",
      [hashedOTP, mobile]
    );

    if (updateResult.affectedRows === 0) {
      connection.release();
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

      //sms_templete
      const var1 = "<%23> ";
      const var3 = " 3 min ";
      const functions = "send_otp";
      const sql = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
      const value1 = [functions];
      const [smstemplate] = await connection.query(sql, value1);
      const template_id = smstemplate[0].template_id;
      const templates = smstemplate[0].templates;
      console.log(templates,smstemplate,"smstemplate")
      var message = templates.replace('#VAR1#', var1);
      var message1 = message.replace('#VAR2#', otp);
      var message2 = message1.replace('#VAR3#', var3);

      //sms_templete

    // Send SMS with OTP
    smsfunction(mobile, template_id, message2 );

    connection.release();
    return res.json({
      status: "send otp",
      statuscode: "02",
      message: "OTP Successfully Sent to Registered Mobile",
    });
  } catch (error) {
    console.error(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

router.post("/generator-new-password", async (req, res) => {
  try {
    const { mobile, password, otp, coordinates, mac_id } = req.body;
    const connection = await poolPromise().getConnection();

    const [fetcheduser] = await connection.query(
      "SELECT * FROM users WHERE mobile = ?",
      [mobile]
    );

    if (fetcheduser.length === 0) {
      connection.release();
      return res.status(422).json({ status: "User not exists!" });
    }

    const user = fetcheduser[0];
    const username = user.name;
    const unique_id = user.unique_id;
    const usertype = user.user_type;
    const secretToken = user.secretToken;
    const storedOTP = user.otp;

    let saltedOTP = SALT.concat(otp);
    var hashedOTP = md5(saltedOTP);

    if (hashedOTP === storedOTP) {
      const [updatepassword] = await connection.query(
        "UPDATE users SET password = ?, coordinates = ?, mac_id = ? WHERE mobile = ?",
        [password, coordinates, mac_id, mobile]
      );

      const token = jwt.sign(
        {
          id: unique_id,
          secret: secretToken,
          mac_id: mac_id,
          mobile: mobile,
        },
        process.env.JWT_KEYS
      );

      connection.release();
      return res.json({
        status: "success",
        statuscode: "01",
        "user name": username,
        "usertype": usertype,
        message: "Login success, go to the dashboard",
        token: token,
      });
    } else {
      connection.release();
      return res.status(422).json({ status: "fail", message: "Invalid OTP" });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(422).json({
      status: "Failed",
      statuscode: "2",
      message: "Something went wrong!",
    });
  }
});

const replacerFunc = () => {
  const visited = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (visited.has(value)) {
        return;
      }
      visited.add(value);
    }
    return value;
  };
};
function generateRandomOrderId() {
  const timestamp = Date.now().toString(); // Get current timestamp
  const randomDigits = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0"); // Generate 4 random digits

  return `${timestamp}${randomDigits}`;
}
function validateMobileNumber(mobile) {
  const cleanedNumber = mobile.replace(/\D/g, "");
  if (cleanedNumber.length === 10) {
    return true;
  } else {
    return false;
  }
}

module.exports = router;
