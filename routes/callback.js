const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const { sendPushNotification } = require('../globalfunction/sendPushNotification');


router.post("/virtualaccount",async (req, res) => {
  var callbackkey = req.headers.callbackkey;
  console.log(callbackkey,"callbackkey")
  if (!callbackkey) {
    return res.status(422).json({
      statuscode: "2",
      status: "Failed",
      message: "Please provide API key",
    });
  }

  var connection;
  try{
    connection = await poolPromise().getConnection();
    const [fetchedKey] = await connection.query(
      "SELECT id FROM callback_key_value WHERE callback_value = ? AND status='Active' ",
      [callbackkey]
    );
  
    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status: "fail",
        message: "INVALID API KEY",
      });
    } else{
      var {
        attempt,
        timestamp,
        callbackTxnId,
        originalCallbackTxnId,
        accountNumber,
        balance,
        transactionMessage,
        type,
        transferType,
        transactionAmount,
        decentroTxnId,
        payeeName,
        payeeAccountNumber,
        payeeAccountIfsc,
        payerVpa,
        bankReferenceNumber,
        transactionType,
        payerName
      } = req.body;
      timestamp = Date.now();
      // console.log("req.body",req,"req.body")
      const response = {
        attempt: attempt,
        timestamp: timestamp,
        callbackTxnId: callbackTxnId,
        originalCallbackTxnId: originalCallbackTxnId, 
        accountNumber: accountNumber,
        balance: balance,
        transactionMessage: transactionMessage,
        type: type,
        transferType: transferType,
        transactionAmount: transactionAmount,
        decentroTxnId: decentroTxnId,
        payeeName: payeeName,
        payeeAccountNumber: payeeAccountNumber,
        payeeAccountIfsc: payeeAccountIfsc,
        payerVpa: payerVpa,
        bankReferenceNumber: bankReferenceNumber,
        transactionType: transactionType,
        payerName: payerName,
      };
      // if accountNumberr = DEFAULT_VA env then no credit 
      if(response.payeeAccountNumber === process.env.payeeAccountNumber1 || response.payeeAccountNumber === process.env.payeeAccountNumber2 || response.payeeAccountNumber === process.env.payeeAccountNumber3 || response.payeeAccountNumber === process.env.payeeAccountNumber4 || response.payeeAccountNumber === process.env.payeeAccountNumber5 || response.payeeAccountNumber === process.env.payeeAccountNumber6){
  
        var [e_settlemen] = await connection.query(
          "SELECT * FROM `e-settlemen` WHERE TxnId= ? AND type = ?",
          [response.decentroTxnId,response.type] //decentroTxnId = TxnId
        );
  
          if (e_settlemen.length === 0 ) {
  
                  const [e_settlemen] = await connection.query(
                    "INSERT INTO `e-settlemen` (type,payeeAccountNumber,payeeName,amount,balance,transferType,bankReferenceNumber,TxnId,transactionMessage,response,timestamp) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                      response.type,
                      response.payeeAccountNumber,// response.accountNumber doubt
                      response.payeeName,
                      response.transactionAmount,
                      response.balance,
                      response.transferType,
                      response.bankReferenceNumber,
                      response.decentroTxnId,
                      response.transactionMessage,
                      JSON.stringify(response),
                      response.timestamp,
                    ]
                  );
              console.log("e_settlemenn",e_settlemen,"e_settlemenn"); 
  
              //if type credit then 
              if(response.type === "credit" || response.type === "Credit"){
  
                const [admin_wallet] = await connection.query(
                  "SELECT * FROM admin_wallet"
                );
          
                var bal_amount = Number(admin_wallet[0].pool) + Number(response.transactionAmount); 
  
                await connection.query(
                  "UPDATE admin_wallet SET pool = ? WHERE id  = ?",
                  [bal_amount, admin_wallet[0].id]
                );
  
                const [result] = await connection.query(
                  "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summary"
                );
          
                var tran_id = result[0].max_tran_id || 0;
                var tran_id_w = tran_id + 1;
                var description = `Decentro Settled INR ${response.transactionAmount} to Credit in your HDFC Bank XXXXXX${response.accountNumber.slice(-6)}`;
                
                const admin_summary = {
                  tran_id: tran_id_w,
                  unique_id: admin_wallet[0].unique_id,
                  ac_type: "pool",
                  type: "CR",
                  amount: response.transactionAmount,
                  description: description,
                  clo_bal: bal_amount,
                  status: "Success",
                };
                await connection.query("INSERT INTO admin_wallet_summary SET ?", [
                  admin_summary,
                ]);
  
              }
              return res.status(200).json({ response_code: "CB_S00000" });
  
          }else {
            return res.status(404).json({ response_code: "CB_S000001" });
          }
  
      } else if(payeeAccountNumber === process.env.DEFAULT_VA){
  
        const [e_collection] = await connection.query(
          "INSERT INTO e_collection (type, payeeAccountNumber, payeeName, amount, settl_amt, transferType, bankReferenceNumber,TxnId, payerName, response, timestamp) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            response.type,
            response.payeeAccountNumber,
            response.payeeName,
            response.transactionAmount,
            0,
            response.transferType,
            response.bankReferenceNumber,
            response.decentroTxnId,
            response.payerName,
            JSON.stringify(response),
            response.timestamp,
          ]
        );
          console.log("process.env.DEFAULT_VA",e_collection,"process.env.DEFAULT_VA");
          if(e_collection.affectedRows === 1 || e_collection.affectedRows === "1"){
            return res.status(200).json({ response_code: "CB_S00000" });
          } else {
            return res.status(404).json({ response_code: "CB_S000001"  }); //response_code: "CB_S000001" 
          }
  
      }else{
  
        const [e_collection] = await connection.query(
            "SELECT * FROM e_collection WHERE amount = ? AND bankReferenceNumber = ?",
            [response.transactionAmount, response.bankReferenceNumber] 
          );
  
          console.log("response.transactionAmount, response.bankReferenceNumber",response.transactionAmount, response.bankReferenceNumber,e_collection)
  
        if (e_collection.length === 0 ) {
  
          const [virtual_account] = await connection.query(
            "SELECT * FROM virtual_account WHERE accountnumber = ?",
            [response.payeeAccountNumber]
          );
  
          // console.log(virtual_account.length === 0,virtual_account,"virtual_accounttttttt",response.payeeAccountNumber,"response.payeeAccountNumber")
         
            if(virtual_account.length === 0){
              const [e_collection] = await connection.query(
                "INSERT INTO e_collection (type, payeeAccountNumber, payeeName, amount, settl_amt, transferType, bankReferenceNumber,TxnId, payerName, response, timestamp) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  response.type,
                  response.payeeAccountNumber,
                  response.payeeName,
                  response.transactionAmount,
                  0,
                  response.transferType,
                  response.bankReferenceNumber,
                  response.decentroTxnId,
                  response.payerName,
                  JSON.stringify(response),
                  response.timestamp,
                ]
              );
                console.log("e_collection",e_collection,"e_collectionn");
                if(e_collection.affectedRows === 1 || e_collection.affectedRows === "1"){
                  return res.status(200).json({ response_code: "CB_S00000" });
                } else {
                  return res.status(404).json({ response_code: "CB_S000001"  }); //response_code: "CB_S000001" 
                }
                 
            }
  
  
          const [[user]] = await connection.query(
            "SELECT package_id FROM users WHERE unique_id = ?",
            [virtual_account[0].unique_id] 
          );
            
          // console.log(user, response.transferType, response.transactionAmount, response.transactionAmount,"package_id,response.transferType,response.transactionAmount,response.transactionAmount")
          
          let [[collection_scheme]] = await connection.execute(
            "SELECT * FROM e_collection_scheme WHERE (packages_id = ? AND type = ? AND (minimum_amt <= ? AND maximum_amt >= ?)) ",
            [user.package_id, response.transferType, response.transactionAmount, response.transactionAmount] //transferType // canged UPI To response.transferType
          );
  
          console.log("collection_schemem",collection_scheme,"collection_scheme");
          
         // added if condition "Amount out of range" in collection_scheme
        if(collection_scheme === undefined){
          [[collection_scheme]] = await connection.execute(
            "select * from e_collection_scheme Where (packages_id = ? AND type = ? and maximum_amt = (SELECT MAX(maximum_amt) AS maximum_amt FROM e_collection_scheme WHERE packages_id = ? AND type = ?))",
            [user.package_id, response.transferType, user.package_id, response.transferType] 
          );
          
          console.log("collection_schemem Amount out of range",collection_scheme,"collection_schemee Amount out of range");
          
        }
  
          const fee = collection_scheme.platform_fee;
          const gst = collection_scheme.gst;
          const fee_type = collection_scheme.fee_type; 
  
          let commissionAmount;
          let newAmount = response.transactionAmount;
          let total;
  
          // added condition fee_type === "Fixed" to calculate commissionAmount 
          if(fee_type === "Fixed"){
            commissionAmount = fee;
          }else{
            commissionAmount = (newAmount / 100) * fee;
          }
  
          newAmount -= (commissionAmount / 100) * gst;
          newAmount -= commissionAmount;
          total = Math.fround(newAmount);
          total = Math.fround(total).toFixed(2);
  
          const [e_collection] = await connection.query(
            "INSERT INTO e_collection (type, payeeAccountNumber, payeeName, amount, settl_amt, transferType, bankReferenceNumber,TxnId, payerName, response, timestamp) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              response.type,
              response.payeeAccountNumber,
              response.payeeName,
              response.transactionAmount,
              Number(total),
              response.transferType,
              response.bankReferenceNumber,
              // response.callbackTxnId,
              response.decentroTxnId,
              response.payerName,
              JSON.stringify(response),
              response.timestamp,
            ]
          );
            console.log("e_collection",e_collection,"e_collectionn") 
  
          const [admin_wallet] = await connection.query(
            "SELECT * FROM admin_wallet"
          );
  
          var bal_amount =
            // Number(admin_wallet[0].wallet) - Number(response.transactionAmount); //new changed
            Number(admin_wallet[0].wallet) - Number(total);
  
          await connection.query(
            "UPDATE admin_wallet SET wallet = ? WHERE id  = ?",
            [bal_amount, admin_wallet[0].id]
          );
  
          const [wallet] = await connection.query(
            "SELECT * FROM wallet WHERE unique_id = ?",
            [virtual_account[0].unique_id]
          );
            console.log("wallet",wallet,"wallet")
          const [result] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summary"
          );
  
          var tran_id = result[0].max_tran_id || 0;
          var tran_id_w = tran_id + 1;
          var description = `Your A/C No. ${response.accountNumber} is DR Rs${response.transactionAmount}/- UPI Ref No ${response.bankReferenceNumber}`;
  
          const admin_summary = {
            tran_id: tran_id_w,
            unique_id: admin_wallet[0].unique_id,
            ac_type: "wallet",
            type: "DR", //chaned CR to DR
            // amount: response.transactionAmount,
            amount: Number(total),
            description: description,
            clo_bal: bal_amount,
            status: "Success",
          };
  
          await connection.query("INSERT INTO admin_wallet_summary SET ?", [
            admin_summary,
          ]);
  
          const update_amount =
            // Number(response.transactionAmount) + Number(wallet[0].wallet);//new changed
            Number(total) + Number(wallet[0].wallet);
  
          await connection.query(
            "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
            [update_amount, virtual_account[0].unique_id]
          );
  
          const [results] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
          );
  
          var tran_id_ = results[0].max_tran_id || 0;
          var tran_id_w_ = tran_id_ + 1;
          var description_ = `Your A/C No. ${response.accountNumber} is Credited Rs${response.transactionAmount}/- UPI Ref No ${response.bankReferenceNumber}`;
  
          const [update_wallet] = await connection.query(
            "SELECT * FROM wallet WHERE unique_id = ?",
            [virtual_account[0].unique_id]
          );
  
          await connection.query(
            "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              virtual_account[0].unique_id,
              tran_id_w_,
              "CR",
              // response.transactionAmount,
              Number(total),
              "Success",
              description_,
              update_wallet[0].wallet,
            ]
          );

          const [fcm_token] = await connection.query(
            "SELECT fcm_token ,customer_id  FROM users WHERE unique_id = ? ",
            [virtual_account[0].unique_id]
          );
          const notify_id = String(fcm_token[0].customer_id) + Date.now() ;
          const title =  "Payment Received";
          const message =  `Dear ${virtual_account[0].name}, Your A/C No. XXXX${response.accountNumber.slice(-4)} is Credited Rs${Number(total)}/- ${response.transferType} Ref No ${response.bankReferenceNumber}. Your Current Balance is Rs ${update_wallet[0].wallet}/-`
          await connection.query(// `response`,
          'INSERT INTO notification (`from`, `to`, `message`, `title`,`notify_id`) VALUES (?, ?, ?, ?, ?)',
            [
              "Admin",//'Admin
              fcm_token[0].customer_id,
              message,
              "Payment Received",
              notify_id
            ]
          );
          sendPushNotification(message, [fcm_token[0].fcm_token], title);
  
          return res.status(200).json({ response_code: "CB_S00000" });
        } else {
          return res.status(404).json({ response_code: "CB_S000001" });
        }
     }
  
  
    }

  }catch (error) {
    console.log(error);
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

})

router.post("/transaction", async (req, res) => {
  var callbackkey = req.headers.callbackkey;
  if (!callbackkey) {
    return res.status(422).json({
      statuscode: "2",
      status: "Failed",
      message: "Please provide API key",
    });
  } 

  var connection;
  try{
    connection = await poolPromise().getConnection();   
    const [fetchedKey] = await connection.query(
      "SELECT id FROM callback_key_value WHERE callback_value = ? AND status='Active' ",
      [callbackkey]
    );
  
    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status: "fail",
        message: "INVALID API KEY",
      });
    } else {
      var {
        transactionStatus, // added
        referenceId,//added
        attempt,
        timestamp,
        callbackTxnId,
        originalCallbackTxnId,
        accountNumber,
        balance,
        transactionMessage,
        type,
        transferType,
        transactionAmount,
        decentroTxnId,
        payerAccountNumber,
        payerAccountIfsc,
        payeeAccountIfsc,
        providerCode,
        bankReferenceNumber,
        npciTxnId
      } = req.body;
      // timestamp = Date.now();
      const response = {
        npciTxnId:npciTxnId,
        transactionStatus: transactionStatus,
        referenceId:referenceId,
        type: type,
        attempt: attempt,
        timestamp: timestamp,
        callbackTxnId: callbackTxnId,
        accountNumber: accountNumber,
        balance: balance,
        transferType: transferType,
        decentroTxnId: decentroTxnId,
        payerAccountNumber: payerAccountNumber,
        payerAccountIfsc: payerAccountIfsc,
        payeeAccountIfsc: payeeAccountIfsc,
        providerCode: providerCode,
        transactionAmount: transactionAmount,
        transactionMessage: transactionMessage,
        bankReferenceNumber: bankReferenceNumber,
        originalCallbackTxnId: originalCallbackTxnId,
      };
  
   
      const [upi_collection] = await connection.query(
        `SELECT * FROM upi_collection WHERE reference_id= ? AND tnxid = ?`,
        [response.referenceId, response.decentroTxnId]
      );
  
      if (upi_collection.length !== 0) {
        var amount = upi_collection[0].amount;
        var unique_id = upi_collection[0].unique_id;
        var attempt = upi_collection[0].attempt; 
  
        const [[users]] = await connection.query(
          "SELECT * FROM users WHERE unique_id = ?",
          [unique_id]
        );
  
        // console.log(users.package_id, response.transferType, response.transactionAmount, response.transactionAmount,"package_id,response.transferType,response.transactionAmount,response.transactionAmount")
        
        let [[collection_scheme]] = await connection.execute(
          "SELECT * FROM e_collection_scheme WHERE packages_id = ? AND type = ? AND (minimum_amt <= ? AND maximum_amt >= ?)",  //added (minimum_amt <= ? AND maximum_amt >= ?)
          [users.package_id, "UPI", response.transactionAmount, response.transactionAmount] //transferType // canged UPI To response.transferType
        );
  
        console.log("collection_schemem",collection_scheme,"collection_schemee");
        
        // added if condition "Amount out of range" in collection_scheme
        if(collection_scheme === undefined){
          [[collection_scheme]] = await connection.execute(
            "select * from e_collection_scheme Where (packages_id = ? AND type = ? and maximum_amt = (SELECT MAX(maximum_amt) AS maximum_amt FROM e_collection_scheme WHERE packages_id = ? AND type = ?))",
            [users.package_id, "UPI", users.package_id, "UPI"]
          );
          console.log("collection_schemem Amount out of range",collection_scheme,"collection_schemee Amount out of range");
        }
        
        if ("UPI_COLLECTION" === response.type) {
          await connection.query(
            "UPDATE upi_collection SET UPI_COLLECTION = ?, bankReferenceNumber = ?, status = ?, npciTransactionId = ? WHERE tnxid = ?",
            [
              JSON.stringify(req.body),
              response.bankReferenceNumber,
              response.transactionStatus,
              response.npciTxnId,//new changed
              response.decentroTxnId
             
            ]
          );
        }
  
        if (
          users.user_type === "User" &&
            Number(attempt) !== 1 &&
            (response.transactionStatus === "success" ||
            response.transactionStatus === "Success" ||
            response.transactionStatus === "SUCCESS")
            ) {
  
          const fee = collection_scheme.platform_fee;
          const gst = collection_scheme.gst;
          const fee_type = collection_scheme.fee_type; //added const fee_type = collection_scheme.fee_type;
    
          let commissionAmount;
          let newAmount = amount;
          let total;
    
          // added condition fee_type === "Fixed" to calculate commissionAmount 
          if(fee_type === "Fixed"){
            commissionAmount = fee;
          }else{
            commissionAmount = (newAmount / 100) * fee;
          }
    
          newAmount -= (commissionAmount / 100) * gst;
          newAmount -= commissionAmount;
          total = Math.fround(newAmount);
          total = Math.fround(total).toFixed(2);
    
          //////////
  
          const [[admin_wallet]] = await connection.query(   
            "SELECT * FROM admin_wallet WHERE status = ?",
            ["Enable"]
          );
  
          var bal_amount = Number(admin_wallet.wallet) - Number(total);
  
          await connection.query(
            "UPDATE admin_wallet SET wallet = ? WHERE id  = ?",
            [bal_amount, admin_wallet.id]
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
          var description = `Rs${total}/- Transfer to ${users.customer_id} collection Ref No.: ${response.bankReferenceNumber}`;
  
          const admin_summary = {
            tran_id: tran_id_w,
            unique_id: "bf508e4f-b685-11ec-9735-00163e0948d5",
            ac_type: "wallet",
            type: "CR",
            amount: total,
            description: description,
            clo_bal: bal_amount,
            status: "Success",
          };
  
          await connection.query("INSERT INTO admin_wallet_summary SET ?", [
            admin_summary,
          ]);
  
          const update_amount = Number(total) + Number(wallet[0].wallet);
  
          await connection.query(
            "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
            [update_amount, unique_id]
          );
  
          const [results] = await connection.query(
            "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
          );
  
          var tran_id_ = results[0].max_tran_id || 0;
          var tran_id_w_ = tran_id_ + 1;
          var description_ = `Credited Rs${total}/- Ref No ${response.bankReferenceNumber}`;
  
          const [update_wallet] = await connection.query(
            "SELECT * FROM wallet WHERE unique_id = ?",
            [unique_id]
          );
  
          await connection.query(
            "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              unique_id,
              tran_id_w_,
              "CR",
              total,
              "Success",
              description_,
              update_wallet[0].wallet,
            ]
          );
  
          await connection.query(
            "UPDATE upi_collection SET attempt = ?  WHERE tnxid = ?",
            [
              1,
              response.decentroTxnId
            ]
          );
          
        }
  
        return res.status(200).json({ response_code: "CB_S00000" });
      } else {
        return res.status(200).json({ response_code: "CB_S00001" });
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

// Inter Group Transfer



module.exports = router;
