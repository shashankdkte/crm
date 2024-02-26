const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const {smsfunction} = require("../globalfunction/smsfunction.js");
const poolPromise = require("../util/connectionPromise");
const TokenAuth = require("../globalfunction/TokenAuth.js");
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const { isEmpty } = require("lodash");

const {
  thirdpartyapis,
  thirdcreateremitter,
  thirdresendverify,
  thirdverification,
  thirdgetrecipient,
  thirdverifiedaccount,
  thirdAddRecipient,
  thirdtransactions,
} = require("../globalfunction/thirdpartyapis");
const requireRemitter = require("../middleware/requireRemitter.js");

router.post("/search-wallet", TokenAuth, async (req, res) => {
  const { mobile_no } = req.body;
  const service_id = "7";
  const api_name = req.originalUrl;
  const connection = await poolPromise().getConnection();

  try{
    const [users_services] = await connection.query(
      "SELECT * FROM users_services WHERE customer_id = ? AND packages_id = ? AND service_id = ? AND status='Enable'",
      [req.users.customer_id, req.users.package_id, service_id]
    );
  
    if (users_services.length === 0) {
      return res.status(404).json({ message: "Your server is disable" });
    } else {
      const dataapi = await thirdpartyapis(mobile_no, api_name);
      const [[results]] = await connection.query(
        "SELECT * FROM remitter WHERE mobile = ?",
        [mobile_no]
      );
      if (dataapi.response_type_id == -1) {
        await connection.query("INSERT INTO eko_api_log SET ?", [
          dataapi.eko_api_log,
        ]);
        return res.status(200).json({
          status: "not available",
          statuscode: "07",
          message: "Create Remitter",
        });
      }
      if (dataapi.response_type_id == 37) {
        await connection.query("INSERT INTO eko_api_log SET ?", [
          dataapi.eko_api_log,
        ]);
        await thirdresendverify(req);
        return res.status(200).json({
          status: "Available",
          statuscode: "04",
          message: "Otp sent please verify OTP",
        });
      }
      if (dataapi.response_type_id == 33) {
        await connection.query("INSERT INTO eko_api_log SET ?", [
          dataapi.eko_api_log,
        ]);
        const apidata = dataapi.data;
        const { used_limit, available_limit, total_limit, name, state } = apidata;
        if (!isEmpty(results)) {
          const sql = `UPDATE remitter SET used_limit = ?, available_limit = ?, total_limit = ?, status = ?, name = ? WHERE mobile = ?`;
          const values = [
            used_limit,
            available_limit,
            total_limit,
            "2",
            name,
            mobile_no,
          ];
  
          await connection.query(sql, values);
  
          if (dataapi.status == 0 && state == "1") {
            await connection.query("INSERT INTO eko_api_log SET ?", [
              dataapi.eko_api_log,
            ]);
            await thirdresendverify(req);
            return res.status(200).json({
              status: "Available",
              statuscode: "04",
              message: "Otp sent please verify OTP",
            });
          }
  
          var otp = Math.floor(1000 + Math.random() * 9000);

  
          await connection.query(
            `UPDATE remitter SET otp_no = ? WHERE mobile = ?`,
            [otp, mobile_no]
          );

          //sms_templete
          
          const functions = "verification_code";
          const sql4 = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
          const value4 = [functions];
          const [smstemplate] = await connection.query(sql4, value4);
          const template_id = smstemplate[0].template_id;
          const templates = smstemplate[0].templates;
          console.log(templates,smstemplate,"smstemplate")
          var message = templates.replace('<otp>', otp);

          //sms_templete

          smsfunction(mobile_no, template_id, message);
  
          return res.json({
            status: "send otp",
            statuscode: "03",
            message: "OTP Successfully Send to Registered Mobile ",
          });
        } else {
          const dob = new Date();
          const address = "";
          const status = "2";
          const sql = `INSERT INTO remitter (mobile, name, dob, address, state_code, used_limit, available_limit, total_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const values = [
            mobile_no,
            name,
            dob,
            JSON.stringify(address),
            dataapi.data.state,
            dataapi.data.used_limit,
            dataapi.data.available_limit,
            dataapi.data.total_limit,
            status,
          ];
  
          await connection.query(sql, values);
  
          var otp = Math.floor(1000 + Math.random() * 9000);

          await connection.query(
            `UPDATE remitter SET otp_no = ? WHERE mobile = ?`,
            [otp, mobile_no]
          );

          //sms_templete
          
          const functions = "verification_code";
          const sql4 = "SELECT template_id,templates FROM sms_template WHERE `function` = ? and `status` = 'Enable'";
          const value4 = [functions];
          const [smstemplate] = await connection.query(sql4, value4);
          const template_id = smstemplate[0].template_id;
          const templates = smstemplate[0].templates;
          console.log(templates,smstemplate,"smstemplate")
          var message = templates.replace('<otp>', otp);

          //sms_templete

          smsfunction(mobile_no, template_id, message );
          return res.json({
            status: "send otp",
            statuscode: "03",
            message: "OTP Successfully Send to Registered Mobile ",
          });
        }
      } else {
        return res.status(500).json({
          status: "error",
          statuscode: "02",
          message: "Failed to create Remitter",
        });
      }
    }

  }catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/wallet-login", TokenAuth, async (req, res) => {
  const { mobile, otp } = req.body;
  const api_name = req.originalUrl;

  if (!mobile || !otp) {
    return res.status(404).json({ message: "Mobile and otp is required !" });
  }

  const connection = await poolPromise().getConnection();

  try{
    const [[remitter]] = await connection.query(
      `SELECT * FROM remitter WHERE mobile = ?`,
      [mobile]
    );
  
    if (isEmpty(remitter)) {
      return res.status(404).json({
        status: "Faield",
        statuscode: "2",
        message: "Invalid Mobile No",
      });
    }
  
    if (remitter.otp_no === otp) {
      const dataapi = await thirdpartyapis(mobile, api_name);
      await connection.query("INSERT INTO eko_api_log SET ?", [
        dataapi.eko_api_log,
      ]);
      const customer_token = jwt.sign({ id: mobile }, process.env.JWT_KEYS);
      return res.status(200).json({
        status: "success",
        statuscode: "1",
        name: dataapi.data.name,
        available_limit: dataapi.data.available_limit,
        total_limit: dataapi.data.total_limit,
        used_limit: dataapi.data.used_limit,
        customer_token,
        message: "Login Successful, Get recipient",
      });
    } else {
      return res.status(404).json({
        status: "Faield",
        statuscode: "2",
        message: "Invalid OTP",
      });
    }

  }catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/search-remitter", TokenAuth, async (req, res) => {
  const { mobile_no } = req.body;
  const service_id = "3";
  const api_name = req.originalUrl;
  const connection = await poolPromise().getConnection();

  try{
    if (req.users.mobile == mobile_no) {
      const [users_services] = await connection.query(
        "SELECT * FROM users_services WHERE customer_id = ? AND packages_id = ? AND service_id = ? AND status='Enable'",
        [req.users.customer_id, req.users.package_id, service_id]
      );
  
      if (users_services.length === 0) {
        return res.status(404).json({ message: "Your server is disable" });
      } else {
        const dataapi = await thirdpartyapis(mobile_no, api_name);
        const [[results]] = await connection.query(
          "SELECT * FROM remitter WHERE mobile = ?",
          [mobile_no]
        );
        if (dataapi.response_type_id == -1) {
          await connection.query("INSERT INTO eko_api_log SET ?", [
            dataapi.eko_api_log,
          ]);
          return res.status(200).json({
            status: "not available",
            statuscode: "07",
            message: "Create Remitter",
          });
        }
        if (dataapi.response_type_id == 37) {
          await connection.query("INSERT INTO eko_api_log SET ?", [
            dataapi.eko_api_log,
          ]);
          await thirdresendverify(req);
          return res.status(200).json({
            status: "Available",
            statuscode: "04",
            message: "Otp sent please verify OTP",
          });
        }
        if (dataapi.response_type_id == 33) {
          const [eko_api_log] = await connection.query(
            "INSERT INTO eko_api_log SET ?",
            [dataapi.eko_api_log]
          );
          const apidata = dataapi.data;
          const { used_limit, available_limit, total_limit, name, state } =
            apidata;
          if (!isEmpty(results)) {
            const sql = `UPDATE remitter SET used_limit = ?, available_limit = ?, total_limit = ?, status = ?, name = ? WHERE mobile = ?`;
            const values = [
              used_limit,
              available_limit,
              total_limit,
              "2",
              name,
              mobile_no,
            ];
  
            await connection.query(sql, values);
            const customer_token = jwt.sign(
              { id: mobile_no },
              process.env.JWT_KEYS
            );
  
            if (dataapi.status == 0 && state == "1") {
              const [eko_api_log] = await connection.query(
                "INSERT INTO eko_api_log SET ?",
                [dataapi.eko_api_log]
              );
              await thirdresendverify(req);
              return res.status(200).json({
                status: "Available",
                statuscode: "04",
                message: "Otp sent please verify OTP",
              });
            }
  
            return res.status(200).json({
              status: "success",
              statuscode: "1",
              name,
              available_limit,
              total_limit,
              used_limit,
              customer_token,
              message: "Login Successful, Get recipient",
            });
          } else {
            const dob = new Date();
            const address = "";
            const status = "2";
            const sql = `INSERT INTO remitter (mobile, name, dob, address, state_code, used_limit, available_limit, total_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
              mobile_no,
              name,
              dob,
              JSON.stringify(address),
              dataapi.data.state,
              dataapi.data.used_limit,
              dataapi.data.available_limit,
              dataapi.data.total_limit,
              status,
            ];
  
            await connection.query(sql, values);
            const customer_token = jwt.sign(
              { id: mobile_no },
              process.env.JWT_KEYS
            );
  
            return res.status(200).json({
              status: "success",
              statuscode: "1",
              name: dataapi.data.name,
              available_limit: dataapi.data.available_limit,
              total_limit: dataapi.data.total_limit,
              used_limit: dataapi.data.used_limit,
              customer_token,
              message: "Login Successful, Get recipient",
            });
          }
        } else {
          return res.status(500).json({
            status: "error",
            statuscode: "02",
            message: "Failed to create Remitter",
          });
        }
      }
    } else {
      return res.status(404).json({ message: "Mobile no. not match" });
    }

  }catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/create-remitter", TokenAuth, async (req, res) => {
  const api_name = req.originalUrl;
  const connection = await poolPromise().getConnection();

  try {
    const dataapi = await thirdcreateremitter(req, api_name);
    if (dataapi.response_type_id == -1) {
      await connection.query("INSERT INTO eko_api_log SET ?", [
        dataapi.eko_api_log,
      ]);
      return res.status(200).json({
        status: "fail",
        statuscode: "02",
        message: dataapi.message,
      });
    }
    if (dataapi.response_type_id == 327) {
      await connection.query("INSERT INTO eko_api_log SET ?", [
        dataapi.eko_api_log,
      ]);
      return res.status(200).json({
        status: "success",
        statuscode: "04",
        message: dataapi.message,
      });
    }
  } catch (error) {
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

router.post("/verify-remitter", TokenAuth, async (req, res) => {
  const api_name = req.originalUrl;
  const connection = await poolPromise().getConnection();
  const { mobile_no } = req.body;
  const dataapi = await thirdverification(req, api_name);

  try{
    
  if (dataapi.response_type_id === -1) {
    await connection.query("INSERT INTO eko_api_log SET ?", [
      dataapi.eko_api_log,
    ]);
    return res.status(200).json({
      status: "fail",
      statuscode: "02",
      message: dataapi.message,
    });
  }
  if (dataapi.response_type_id == 300) {
    const dataapi = await thirdpartyapis(mobile_no, api_name);

    if (dataapi.response_type_id == 33) {
      await connection.query("INSERT INTO eko_api_log SET ?", [
        dataapi.eko_api_log,
      ]);
      const apidata = dataapi.data;
      const { used_limit, available_limit, total_limit, name, state } = apidata;

      const [[results]] = await connection.query(
        "SELECT * FROM remitter WHERE mobile = ?",
        [mobile_no]
      );
      if (!isEmpty(results)) {
        const sql = `UPDATE remitter SET used_limit = ?, available_limit = ?, total_limit = ?, status = ?, name = ? WHERE mobile = ?`;
        const values = [
          used_limit,
          available_limit,
          total_limit,
          "2",
          name,
          mobile_no,
        ];

        await connection.query(sql, values);
        const customer_token = jwt.sign(
          { id: mobile_no },
          process.env.JWT_KEYS
        );

        if (dataapi.status == 0 && state == "1") {
          await connection.query("INSERT INTO eko_api_log SET ?", [
            dataapi.eko_api_log,
          ]);
          await thirdresendverify(req);
          return res.status(200).json({
            status: "Available",
            statuscode: "04",
            message: "Otp sent please verify OTP",
          });
        }

        return res.status(200).json({
          status: "success",
          statuscode: "1",
          name,
          available_limit,
          total_limit,
          used_limit,
          customer_token,
          message: "Login Successful, Get recipient",
        });
      } else {
        const dob = new Date();
        const address = "";
        const status = "2";
        const sql = `INSERT INTO remitter (mobile, name, dob, address, state_code, used_limit, available_limit, total_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [
          mobile_no,
          name,
          dob,
          JSON.stringify(address),
          dataapi.data.state,
          dataapi.data.used_limit,
          dataapi.data.available_limit,
          dataapi.data.total_limit,
          status,
        ];

        await connection.query(sql, values);
        const customer_token = jwt.sign(
          { id: mobile_no },
          process.env.JWT_KEYS
        );

        return res.status(200).json({
          status: "success",
          statuscode: "1",
          name: dataapi.data.name,
          available_limit: dataapi.data.available_limit,
          total_limit: dataapi.data.total_limit,
          used_limit: dataapi.data.used_limit,
          customer_token,
          message: "Login Successful, Get recipient",
        });
      }
    } else {
      return res.status(200).json({
        status: "fail",
        statuscode: "02",
        message: dataapi.message,
      });
    }
  } else {
    return res.status(200).json({
      status: "fail",
      statuscode: "02",
      message: dataapi.message,
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

router.get("/get-recipient", [TokenAuth, requireRemitter], async (req, res) => {
  var mobile_no = req.remitter.mobile;
  const dataapi = await thirdgetrecipient(mobile_no);
  const recipientdata = dataapi.data.recipient_list;
  const connection = await poolPromise().getConnection();

  try{
    
  if (dataapi.message === "No recepients found") {
    return res.status(201).json({ status: "fail", message: " Not data found" });
  } else {
    const recipientIds = recipientdata.map(
      (recipient) => recipient.recipient_id
    );

    const [recipientDataFromDb] = await connection.query(
      "SELECT * FROM recipient WHERE remitterid = ? AND recipient_id IN (?)",
      [mobile_no, recipientIds]
    );

    const existingRecipientIds = recipientDataFromDb.map(
      (recipient) => recipient.recipient_id
    );

    for (let i = 0; i < recipientdata.length; i++) {
      const recipientdatas = recipientdata[i];

      const recipient_id = recipientdatas["recipient_id"];
      if (existingRecipientIds.includes(recipient_id)) {
        console.log(
          `Recipient with recipient_id ${recipient_id} already exists, skipping insertion.`
        );
        continue;
      }
      const recipient_name = recipientdatas["recipient_name"];
      const recipient_mobile = recipientdatas["recipient_mobile"];
      const bank = recipientdatas["bank"];
      const account = recipientdatas["account"];
      const ifsc = recipientdatas["ifsc"];
      const verified = recipientdatas["is_verified"] ? "Yes" : "No";
      const status = "Activated";

      const [insertResult] = await connection.query(
        "INSERT INTO recipient (remitterid ,recipient_id, recipient_name, recipient_mobile, bank, account, ifsc, verified, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          mobile_no,
          recipient_id,
          recipient_name,
          recipient_mobile,
          bank,
          account,
          ifsc,
          verified,
          status,
        ]
      );

      if (insertResult.length === 0) {
        return res.status(422).json({
          status: "fail",
          message: "Error in adding INSERT INTO recipient",
        });
      }
    }

    const insertResult = await Insartedata(mobile_no);

    return res.status(200).json({ status: "success", insertResult });
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
  "/verified_bank_ac",
  [TokenAuth, requireRemitter],
  async (req, res) => {
    const { account, ifsc, bank_name } = req.body;
    var mobile_no = req.remitter.mobile;
    var unique_id = req.users.unique_id;
    const connection = await poolPromise().getConnection();

    try{
      
    const [results] = await connection.query(
      `SELECT * FROM wallet WHERE unique_id = ?`,
      [unique_id]
    );

    const curntBalance = results.length > 0 ? results[0].wallet : 0;
    if (results[0].status === "Enable") {
      if (10 > curntBalance) {
        connection.release();
        return res
          .status(400)
          .json({ success: false, message: "Insufficient balance" });
      }
      const fee = 3.5;
      const holdbal = curntBalance - fee;

      const [recipientDataFromDb] = await connection.query(
        "SELECT * FROM verified_account WHERE account = ? AND ifsc_code IN (?)",
        [account, ifsc]
      );

      if (recipientDataFromDb.length === 0) {
        const [results] = await connection.query(
          "SELECT MAX(`order_id`) AS `max_order_id` FROM `ac-verification`"
        );

        const maxOrderId = results[0].max_order_id;
        const newOrderId = maxOrderId ? JSON.parse(maxOrderId) + 1 : 0;
        var bankCode = ifsc.substring(0, 4);

        const [bank_id] = await connection.query(
          "SELECT bankid FROM bank_id WHERE shortcode = ?",
          [bankCode]
        );

        if (!bank_id[0]) {
          return res.status(500).json({
            status: "error",
            message: "Incorrent bank details",
          });
        }
        const bankid = bank_id[0].bankid;
        const resp = {
          client_ref_id: newOrderId,
          mobile_no: mobile_no,
          account: account,
          ifsc: ifsc,
        };
        const dataapi = await thirdverifiedaccount(resp);
        var response = dataapi.data;
        var recipient_name = response.recipient_name;
        var tid = response.tid;

        // insart in table
        if (dataapi.status === 0) {
          const insertdata = {
            order_id: newOrderId,
            unique_id: unique_id,
            ifsc: ifsc,
            accounts: account,
            recipient_name: recipient_name,
            fee: fee,
            status: "Success",
            tid: tid,
            response: JSON.stringify(response),
          };

          await connection.query(
            "INSERT INTO `ac-verification` SET ?",
            insertdata
          );

          const accountdata = {
            bank_name: bank_name,
            ifsc_code: ifsc,
            account: account,
            beneficiary_name: recipient_name,
            bank_id: bankid,
            ac_type: "3",
          };

          await connection.query(
            "INSERT INTO `verified_account` SET ?",
            accountdata
          );

          const [result] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
          );

          var tran_id = result[0].max_tran_id || 0;
          var tran_id_w = tran_id + 1;
          var description = `Rs.${fee}/ Debit for Account verification Charges`;

          await connection.query(
            "INSERT INTO walletsummary (tran_id, unique_id, amount, type, description, closing_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [tran_id_w, unique_id, fee, "DR", description, holdbal, "Success"]
          );

          await connection.query(
            "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
            [holdbal, unique_id]
          );

          return res.status(200).json({
            status: "success",
            message: "Available",
            data: accountdata,
          });
        } else {
          return res
            .status(200)
            .json({ status: "fail", message: dataapi.message });
        }
      } else {
        return res.status(200).json({
          status: "success",
          statuscode: "01",
          message: "Available",
          data: recipientDataFromDb,
        });
      }
    } else {
      return res.status(200).json({
        status: "fail",
        message:
          "your wallet status not Enabled please contact to customer care",
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

router.post(
  "/add-recipient",
  [TokenAuth, requireRemitter],
  async (req, res) => {
    const api_name = req.originalUrl;
    const { recipient_mobile, account, ifsc, bank_id, recipient_name } =
      req.body;
    if (!recipient_mobile | !account | !ifsc | !bank_id | !recipient_name) {
      return res.status(404).json({
        status: "fail",
        statuscode: "02",
        message: "All values requried ",
      });
    }
    const connection = await poolPromise().getConnection();

    try {
      const dataapi = await thirdAddRecipient(
        req,
        req.remitter.mobile,
        api_name
      );

      await connection.query("INSERT INTO eko_api_log SET ?", [
        dataapi.eko_api_log,
      ]);

      if (dataapi.response_status_id == 0) {
        const [bankdata] = await connection.execute(
          "SELECT * FROM bank_id WHERE bankid = ?",
          [req.body.bank_id]
        );

        const [results] = await connection.execute(
          "INSERT INTO recipient (remitterid, recipient_id, recipient_name, recipient_mobile, bank, account, ifsc, verified, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            req.remitter.mobile,
            dataapi.data.recipient_id,
            req.body.recipient_name,
            req.body.recipient_mobile,
            bankdata[0].bank_name,
            req.body.account,
            req.body.ifsc,
            "Yes",
            "Activated",
          ]
        );

        return res.send({
          status: "success",
          statuscode: "01",
          data: {
            remitterid: req.users.mobile,
            recipient_id: dataapi.data.recipient_id,
            recipient_name: req.body.recipient_name,
            recipient_mobile: req.body.recipient_mobile,
            bank: bankdata[0].bank_name,
            account: req.body.account,
            ifsc: req.body.ifsc,
            verified: "Yes",
            status: "Activated",
          },
        });
      } else {
        return res.status(400).send({
          status: "fail",
          statuscode: "02",
          message: dataapi.message,
        });
      }
    } catch (error) {
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
  }
);

router.post(
  "/money-transfer",
  [TokenAuth, requireRemitter],
  async (req, res) => {
    const api_name = req.originalUrl;
    const unique_id = req.users.unique_id;
    const package_id = req.users.package_id;

    const {
      recipient_id,
      amount,
      coordinates,
      mac_id,
      device_Id,
      tran_id,
      tpin,
    } = req.body;
    const remitter_id = req.remitter.mobile;
    const connection = await poolPromise().getConnection();

    try{
      const [[dmt_scheme]] = await connection.query(
        "SELECT * FROM dmt_scheme WHERE scheme_id = ?",
        [package_id]
      );
  
      if (dmt_scheme.length === 0) {
        return res.status(404).json({
          statuscode: "2",
          status: "Failed",
          message: "Services is expire.",
        });
      }
  
      if (req.users.mac_id === mac_id || device_Id === req.users.device_Id) {
        const [results] = await connection.execute(
          "SELECT tpin FROM users WHERE unique_id = ?",
          [unique_id]
        );
  
        console.log(results,"rrrrrrrrrresults")
        if (results[0].tpin === null || results.length === 0) {
          connection.release();
          return res
            .status(422)
            .json({ status: "fail", message: "your tpin is not set" });
        }
  
        if (results[0].tpin === JSON.parse(tpin)) {
          const [savedtranid] = await connection.query(
            "SELECT * FROM dmt_transfer WHERE dmt_transfer.tran_id = ?",
            [tran_id]
          );
  
          if (savedtranid.length > 0) {
            return res.status(422).json({
              status: "fail",
              message: "alrady tran_id in the table ",
            });
          } else {
            if (5000 >= amount && amount >= 100) {
              const [dmt_scheme] = await connection.execute(
                "SELECT * FROM dmt_scheme WHERE minamount <= ? AND maxamount >= ? AND scheme_id = ? ORDER BY id ASC LIMIT 1",
                [amount,amount,package_id]
              );
                // console.log("dmt_scheme",dmt_scheme,"dmt_scheme")
              const fee = dmt_scheme[0].fee;
              const charge = dmt_scheme[0].charge;
              const tds = dmt_scheme[0].tds;
              const commission = dmt_scheme[0].commission;
  
              const [wallet] = await connection.execute(
                "SELECT * FROM wallet WHERE unique_id = ?",
                [unique_id]
              );
  
              if (
                wallet[0].status === "Disable" ||
                wallet[0].status === "Freeze"
              ) {
                connection.release();
                return res.status(400).json({
                  statuscode: "2",
                  status: "Failed",
                  message: `your wallet is ${wallet[0].status} please contact customer care`,
                });
              }
  
              const curntBalance = wallet.length > 0 ? wallet[0].wallet : 0;
  
              if (amount > curntBalance) {
                connection.release();
                return res.status(400).json({
                  success: false,
                  message: "Insufficient balance",
                });
              }
  
              const total = parseInt(amount) + JSON.parse(charge);
              const updatedbal = curntBalance - total;
  
              const [fetchedrecipient] = await connection.execute(
                "SELECT * FROM recipient WHERE recipient_id = ? AND remitterid = ?",
                [recipient_id, remitter_id]
              );
  
              if (fetchedrecipient.length > 0) {
                const recipient_name = fetchedrecipient[0].recipient_name;
                const bank_name = fetchedrecipient[0].bank;
                const recipient_mobile = fetchedrecipient[0].recipient_mobile;
                const account = fetchedrecipient[0].account;
                const ifsc = fetchedrecipient[0].ifsc;
                const status = fetchedrecipient[0].status;
  
                const [getorderid] = await connection.execute(
                  "SELECT MAX(`order_id`) as max_order_id FROM dmt_transfer"
                );
                let orderid;
                if (
                  getorderid.length === 0 &&
                  getorderid[0].max_order_id === null
                ) {
                  orderid = WALLET_ORDERID;
                } else {
                  orderid = Number(getorderid[0].max_order_id) + 1;
                }
  
                const date = new Date();
                const isoString = date.toISOString();
                const ekoparamter = {
                  time_stamp: isoString,
                  remitter_id: remitter_id,
                  recipient_id: recipient_id,
                  coordinates: coordinates,
                  order_id: orderid,
                  amount: amount,
                };
  
                const dataapi = await thirdtransactions(ekoparamter, api_name);
  
                await connection.query("INSERT INTO eko_api_log SET ?", [
                  dataapi.eko_api_log,
                ]);
  
                if (dataapi.status === 0) {
                  const [walletsummary] = await connection.execute(
                    "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
                  );
                  const max_tran_id = walletsummary[0].max_tran_id || 0;
  
                  const transaction = {
                    order_id: JSON.parse(orderid),
                    unique_id: unique_id,
                    tran_id: tran_id,
                    amount: amount,
                    remitter_id: remitter_id,
                    recipient_id: recipient_id,
                    recipient_mobile: recipient_mobile,
                    recipient_name: recipient_name,
                    bank: bank_name,
                    account: account,
                    ifsc_code: ifsc,
                    channel: "IMPS",
                    fee: fee,
                    commission: commission,
                    tds: tds,
                    reference_id: dataapi.data.bank_ref_num,
                    coordinates: coordinates,
                    status: "success",
                    response: JSON.stringify(dataapi.eko_api_log.response),
                    req_response: JSON.stringify(dataapi.eko_api_log.request),
                    tid: dataapi.data.tid,
                  };
  
                  const [results] = await connection.query(
                    "INSERT INTO dmt_transfer SET ?",
                    [transaction]
                  );
  
                  const description = `Rs.${amount}/- Money Transfer to ${recipient_name} - ${bank_name} -${account}`;
  
                  await connection.execute(
                    "INSERT INTO walletsummary (tran_id, unique_id, amount, type, description, closing_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                      max_tran_id + 1,
                      unique_id,
                      total,
                      "DR",
                      description,
                      updatedbal,
                      "Success",
                    ]
                  );
  
                  await connection.execute(
                    "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
                    [updatedbal, unique_id]
                  );
  
                  const data = {
                    amount: amount,
                    bank_ref_num: dataapi.data.bank_ref_num,
                    channel_desc: dataapi.data.channel_desc,
                    recipient_id: recipient_id,
                    recipient_name: dataapi.data.recipient_name,
                  };
  
                  return res.status(200).json({
                    status: "success",
                    "Status Code": "1",
                    message: dataapi.data.message,
                    data,
                  });
                } else {
                  const [results] = await connection.query(
                    "INSERT INTO dmt_transfer (order_id, tran_id, unique_id, remitter_id, recipient_id, recipient_mobile, recipient_name, bank, ifsc_code, account, channel, amount, status, fee, commission, tds, reference_id, coordinates, response, req_response) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [
                      orderid,
                      tran_id,
                      unique_id,
                      remitter_id,
                      recipient_id,
                      recipient_mobile,
                      recipient_name,
                      bank_name,
                      ifsc,
                      account,
                      "IMPS",
                      amount,
                      "Failed",
                      fee,
                      commission,
                      tds,
                      "",
                      coordinates,
                      dataapi.eko_api_log.response,
                      dataapi.eko_api_log.request,
                    ]
                  );
  
                  if (dataapi.status === 347) {
                    return res.status(200).json({
                      status: "fail",
                      message:
                        "IMPS Service Temporarily Down Please try after some time",
                    });
                  }
                  return res.status(200).json({
                    status: "fail",
                    message: dataapi.message,
                  });
                }
              } else {
                return res.status(200).json({
                  status: "error",
                  message: "invalid recipient id",
                });
              }
            } else {
              return res.status(200).json({
                status: "error",
                message: `Amount should be between Rs ${100} and Rs ${50000}`,
              });
            }
          }
        }else {
          return res
            .status(404)
            .json({ status: "error", message: "tpin does not match" });
        }
      } else {
        return res
          .status(200)
          .json({ status: "error", message: "mac address does not match" });
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

const Insartedata = async (mobile_no) => {
  const connection = await poolPromise().getConnection();
  return new Promise(async (resolve, reject) => {
    try {
      const recipientDataFromDbAll = await connection.query(
        "SELECT * FROM recipient WHERE remitterid = ?",
        [mobile_no]
      );
      resolve(recipientDataFromDbAll[0]);
    } catch (error) {
      reject(error);
    }finally {
      if (connection) {
        await connection.release();
      }
    }
  });
};

module.exports = router;
