const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const TokenAuth = require("../globalfunction/TokenAuth.js");
const { v4: uuidv4 } = require("uuid");

const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const { isEmpty } = require("lodash");
const multer = require("multer");
const {
  fetchRechargePlans,
  fetchConnectionDetails,
  statusCheck,
  fetchViewBill,
  recharge,
  callEko,
} = require("../globalfunction/thirdpartyapis");

router.get("/get-category", async (req, res) => {
  const connection = await poolPromise().getConnection();
  const [results] = await connection.query(
    'SELECT * FROM services_manager WHERE category_type = "Utility" AND status = "Enable"'
  );

  const tree = createTree(results);
  await connection.release();
  return res
    .status(200)
    .json({ status: "success", statuscode: "01", data: tree });
});

router.get("/get-location", async (req, res) => {
  const connection = await poolPromise().getConnection();
  let query = "SELECT * FROM location WHERE status = 'Enable'";
  const queryValues = [];

  if (req.query.type) {
    query += " AND type = ?";
    queryValues.push(req.query.type);
  }

  const [results] = await connection.query(query, queryValues);

  const updatedArray = results.map(({ status, id, type, ...rest }) => rest);
  await connection.release();
  return res
    .status(200)
    .json({ status: "success", statuscode: "01", data: updatedArray });
});

router.get("/get-operator", async (req, res) => {
  const connection = await poolPromise().getConnection();

  const query = "SELECT * FROM operator WHERE cate_id = ? AND status = ? ";
  const queryValues = [req.query.cate_id, "Enable"];

  const [results] = await connection.query(query, queryValues);

  const updatedArray = results.map(({ status, id, ...rest }) => rest);

  await connection.release();
  return res
    .status(200)
    .json({ status: "success", statuscode: "01", data: updatedArray });
});

router.get("/get-operator-params", async (req, res) => {
  if (!req.query.op_id) {
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Please provide operator",
    });
  }

  const connection = await poolPromise().getConnection();

  const query = "SELECT * FROM operator_parameters WHERE op_id = ?";
  const queryValues = [req.query.op_id];

  const [results] = await connection.query(query, queryValues);

  if (isEmpty(results)) {
    await connection.release();
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "No parameters found",
    });
  }

  const updatedArray = results.map(
    ({
      status,
      cat_id,
      op_id,
      category,
      operator_Name,
      param_id,
      param_name,
      regex,
      param_label,
      message,
      id,
      ...rest
    }) => ({
      param_id,
      param_label,
      param_name,
      regex,
      message,
    })
  );
  await connection.release();
  return res.status(200).json({
    status: "success",
    statuscode: "01",
    cat_id: results[0].cat_id,
    category: results[0].category,
    op_id: results[0].op_id,
    operator_Name: results[0].operator_Name,
    data: updatedArray,
  });
});

router.get("/fetch-connection-details/:mob", TokenAuth, async (req, res) => {
  const mobile_number = req.params.mob;
  const response = await fetchConnectionDetails(mobile_number);
  const data = response.data.data;

  const connection = await poolPromise().getConnection();

  const query =
    "SELECT * FROM operator_wish_api,location WHERE operator_wish_api.api_Id = ? and circle_id = ? ";
  const queryValues = [data.operatorId, data.circleId];

  const [results] = await connection.query(query, queryValues);

  const { op_id, operator_name, circle_id, circle_name } = results[0];

  await connection.release();
  return res.status(200).json({
    status: "success",
    statuscode: "01",
    data: { op_id, operator_name, circle_id, circle_name },
  });
});

router.get(
  "/fetch-recharge-plans/:operator/:circle?",
  TokenAuth,
  async (req, res) => {
    const operator = req.params.operator;
    const circle = req.params.circle;
    let cn = "";
    if (req.query.cn) {
      cn = req.query.cn;
    }
    if (!operator) {
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        statuscode: "02",
        message: "Please provide operator",
      });
    }

    const connection = await poolPromise().getConnection();

    const query = "SELECT * FROM operator_wish_api WHERE op_id = ?";
    const queryValues = [operator];

    const [results] = await connection.query(query, queryValues);

    const response = await fetchRechargePlans(results[0].api_Id, circle, cn);
    const updatedArray = response.data
      ? response.data.plans.map(({ operatorId, ...rest }) => rest)
      : [];
    if (response.success) {
      await connection.release();
      return res.status(200).json({
        status: "success",
        statuscode: "01",
        api_id: results[0].api_Id,
        data: updatedArray,
      });
    } else {
      await connection.release();
      return res.status(200).json({
        status: "failed",
        statuscode: "01",
      });
    }
  }
);

router.post("/fetch-bills", TokenAuth, async (req, res) => {
  const { op_id, accountno, additional_params } = req.body;
  let types;
  if (req.body.types) {
    types = req.body.types;
  }
  const connection = await poolPromise().getConnection();
  let response_body = null;
  let status_fetch_bills = "Pending";


  let query = "SELECT * FROM operator_wish_api WHERE op_id = ?";
  if (types) {
    query += " AND types = '" + types + "'";
  }
  let [results] = await connection.query(query, [op_id]);
 
  if (!results) {
    await connection.release();
    return res.status(200).json({
      status: "failed",
      statuscode: "02",
      message: "Invalid Data",
    });
  }

  if (results.length === 0)
  {
    return res.status(422).json({
      status: "failed",
      statuscode: "02",
      message:"No operator found for given op_id"
    })
  }

  if (results.length > 0)
  {
    const status_value = results[0].status;
    if (status_value === "False")
    {
    let query = "SELECT * FROM operator_wish_api WHERE op_id = ? and status = ?";
   if (types) {
            query += " AND types = '" + types + "'";
      }
      const [results_operator] = await connection.query(query, [op_id, true]);
      if (results_operator.length > 0)
      {
        results = results_operator;
      }
      else
      {
      return res.status(422).json({
      status: "failed",
      statuscode: "02",
      message:"Operator is down"
    })
      }
    }
  }
 
  const s_p_name = results[0].s_p_name;
  if (s_p_name.toLowerCase() === "eko")
  {
   
  const unique_id = req.users.unique_id;
  const user_query = "SELECT * from users WHERE unique_id = ?";
  const user_params = [unique_id];


  const [user_value] = await connection.query(user_query, user_params);
  const order_id = Date.now();
  const op_query = "SELECT * from operator WHERE op_id = ?";
  const op_params = [op_id];
  const [op_value] = await connection.query(op_query, op_params);
    // fetch bills
  const bill_query_pending = "INSERT INTO fetch_bill (utility_account_no,unique_id,user_type,date,order_id,operator_icon,operator_id,operator_name,ad,status,request,response)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)";
  const bill_params_pending = [accountno,user_value[0].unique_id,user_value[0].user_type,new Date(),order_id,op_value[0].icon,op_id,op_value[0].operator_name,JSON.stringify(additional_params),"Pending","",JSON.stringify(response_body)];
  await connection.query(bill_query_pending, bill_params_pending);
    
    const { response_eko : responseValue, config: configValue } = await callEko(op_id,accountno);
    // return res.json({Data:"Data"});
    console.log(responseValue);

  if (responseValue.data.response_status_id === -1)
  {
    const {amount:billAmount,billdate,billDueDate:dueDate,utilitycustomername:userName,customer_id } = responseValue.data.data;
    const bill_query = "UPDATE fetch_bill SET customer_name = ? ,amount = ?,status = ?,request = ? ,response = ? WHERE order_id = ?";
  const bill_params = [userName,  billAmount,"Success",JSON.stringify(configValue),JSON.stringify(responseValue.data.data),order_id];
  const [bill_value] = await connection.query(bill_query, bill_params);
    
    await connection.release();
    return res.status(200).json({
      status: "success",
      statuscode: "01",
      data: {
        "billAmount": billAmount,
        "billnetamount": billAmount,
        "billdate": billdate,
        "dueDate": dueDate,
        "acceptPayment": true,
        "acceptPartPay": false,
        "cellNumber": customer_id,
        "userName":userName
        
      },
    });
  } else
  {
    console.log(JSON.stringify(configValue));
      // fetch bills
  const bill_query = "UPDATE fetch_bill SET request = ? ,response = ?, status = ? WHERE order_id = ?";
  const bill_params = [JSON.stringify(configValue),JSON.stringify(responseValue.data), "Failed",order_id];
  const [bill_value] = await connection.query(bill_query, bill_params);
    await connection.release();
    return res.status(200).json({
      status: "failed",
      statuscode: "02",
      message: responseValue.data.message,
    });
  }
  }
  
    


   else if (s_p_name.toLowerCase() === "mobikwik")
  {
  
      const unique_id = req.users.unique_id;
  const user_query = "SELECT * from users WHERE unique_id = ?";
  const user_params = [unique_id];


  const [user_value] = await connection.query(user_query, user_params);
  const order_id = Date.now();
  const op_query = "SELECT * from operator WHERE op_id = ?";
  const op_params = [op_id];
  const [op_value] = await connection.query(op_query, op_params);
    // fetch bills
  const bill_query_pending = "INSERT INTO fetch_bill (utility_account_no,unique_id,user_type,date,order_id,operator_icon,operator_id,operator_name,ad,status,request,response)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)";
  const bill_params_pending = [accountno,user_value[0].unique_id,user_value[0].user_type,new Date(),order_id,op_value[0].icon,op_id,op_value[0].operator_name,JSON.stringify(additional_params),"Pending","",JSON.stringify(response_body)];
  await connection.query(bill_query_pending, bill_params_pending);
  
  const {responseValue:response,config:configValue} = await fetchViewBill(
    results[0].api_Id,
    accountno,
    additional_params
  );

  if (response.data.success)
  {
    const {billAmount,billnetamount,dueDate,acceptPayment,cellNumber,userName } = response.data.data[0];
    const bill_query = "UPDATE fetch_bill SET customer_name = ? ,amount = ?,status = ?,request = ? ,response = ? WHERE order_id = ?";
  const bill_params = [userName,  billAmount,"Success",JSON.stringify(configValue),JSON.stringify(response.data.data),order_id];
  const [bill_value] = await connection.query(bill_query, bill_params);
    
    await connection.release();
    return res.status(200).json({
      status: "success",
      statuscode: "01",
      data: response.data.data,
    });
  } else
  {
    
      // fetch bills
  const bill_query = "UPDATE fetch_bill SET request = ? ,response = ?, status = ? WHERE order_id = ?";
  const bill_params = [JSON.stringify(configValue),JSON.stringify(response.data.message), "Failed",order_id];
  const [bill_value] = await connection.query(bill_query, bill_params);
    await connection.release();
    return res.status(200).json({
      status: "failed",
      statuscode: "02",
      message: response.data.message.text,
    });
  }
  }
  
  

});

router.post("/payment", TokenAuth, async (req, res) => {
  const parseString = require("xml2js").parseString;
  const unique_id = req.users.unique_id;
  const package_id = req.users.package_id;
  const expiry = req.users.expiry;
  console.log(expiry)
  let order_id = "";
  let operator_api_result;
  let types;
  const {
    reqid,
    op_id,
    amt,
    accountno,
    additional_params,
    coordinates,
    client_ref_id,
    customer_name,
  } = req.body;
  if (req.body.types) {
    types = req.body.types;
  }

  let responseG, urlG;
  const validation_Parameters = {
    op_id,
    amt,
    accountno,
    coordinates,
    client_ref_id,
  };
  function validateField(value, fieldName) {
    if (!value) {
      return "Please provide " + fieldName;
    }
    return null;
  }

  const validationErrors = [];
  for (const key in validation_Parameters) {
    if (Object.hasOwnProperty.call(validation_Parameters, key)) {
      const element = validation_Parameters[key];
      const error = validateField(element, key);
      if (error) {
        validationErrors.push(error);
      }
    }
  }

  if (validationErrors.length > 0) {
    return res.status(400).send({
      status: "failed",
      statuscode: "02",
      message: validationErrors,
    });
  }

  const connection = await poolPromise().getConnection();

  try {
    const [[utilityData]] = await connection.query(
      `SELECT * FROM utility WHERE client_ref_id = ?`,
      [client_ref_id]
    );
    if (utilityData) {
      return res.status(200).send({
        status: "failed",
        statuscode: "02",
        message: "Duplicate CLIENT_REF_ID",
      });
    }
    
    const expiryDate = new Date(expiry);
    const now = new Date();
    if (expiryDate < now) {
      connection.release();
      return res.status(200).send({
        status: "failed",
        statuscode: "02",
        message: "Your Plan expired",
      });
    }

    const [[walletResult]] = await connection.query(
      `SELECT * FROM wallet WHERE unique_id = ? `,
      [unique_id]
    );

    if (walletResult.status === "Disable" || walletResult.status === "Freeze") {
      return res.status(404).json({
        status: "failed",
        statuscode: "02",
        message: `Your wallet has been ${walletResult.status}`,
      });
    }

    const balance = walletResult.wallet;
    if (amt > balance) {
      connection.release();

      return res.status(200).send({
        status: "failed",
        statuscode: "02",
        message: "Insufficient account balance",
      });
    }

    let opQuery = `SELECT * FROM operator_wish_api WHERE op_id = ? AND STATUS="True" `;
    if (types) {
      opQuery += "AND types = '" + types + "'";
    }

    const [[operatorApiResult]] = await connection.query(opQuery, [op_id]);
    if (!operatorApiResult) {
      return res.status(200).json({
        status: "failed",
        statuscode: "02",
        message: "Operator down",
      });
    }
    operator_api_result = operatorApiResult;
    let [[max_order_id]] = await connection.query(
      "SELECT MAX(`order_id`) AS max_order_id FROM utility"
    );
    let order_id = max_order_id.max_order_id;
    order_id = parseInt(order_id) + 1;
    order_id = String(order_id);

    let holdbalance = walletResult.wallet;
    if (amt > balance) {
      connection.release();
      let utility = {
        unique_id: unique_id,
        user_type: req.users.user_type,
        order_id: order_id,
        client_ref_id: null,
        operator_name:
          operatorApiResult.operator_name + "-" + (types ? types : ""),
        customer_name,
        utility_account_no: accountno,
        ad: JSON.stringify(additional_params),
        amount: amt,
        status: "Failed",
        oprefno: null,
        earned: null,
        tds: null,
        txid: null,
        coordinates: coordinates,
        request: null,
        op_id: op_id,
        response: "INSUFFICIENT FUNDS",
      };
      await connection.query(
        `INSERT INTO utility (\`${Object.keys(utility).join(
          "`,`"
        )}\`) VALUES (${Object.keys(utility)
          .map((item, key) =>
            key == Object.keys(utility).length - 1 ? "?" : "?,"
          )
          .join("")})`,
        Object.values(utility)
      );
      return res.status(200).send({
        status: "failed",
        statuscode: "02",
        message: "Insufficient account balance",
      });
    }

    const [[utilitySchemeResult]] = await connection.query(
      `SELECT * FROM utility_scheme WHERE package_id = ? AND op_id = ?`,
      [package_id, op_id]
    );

    const commission_type = utilitySchemeResult.com_type;
    const commission = utilitySchemeResult.commission;
    let newAmount = amt;
    let commissionAmount = 0;
    let net_debited = 0;
    if (commission_type === "Fixed") {
      commissionAmount = commission;
      newAmount -= commissionAmount;
      newAmount += (commissionAmount / 100) * 5;
      holdbalance -= newAmount;
      net_debited = newAmount;
    } else {
      commissionAmount = (newAmount / 100) * commission;
      newAmount -= commissionAmount;
      newAmount += (commissionAmount / 100) * 5;
      holdbalance -= newAmount;
      net_debited = newAmount;
    }

    await connection.query("UPDATE wallet SET wallet = ? WHERE unique_id = ?", [
      holdbalance,
      unique_id,
    ]);

    let utility = {
      unique_id: unique_id,
      user_type: req.users.user_type,
      order_id: order_id,
      client_ref_id: client_ref_id,
      operator_name: operatorApiResult.operator_name,
      customer_name,
      utility_account_no: accountno,
      ad: JSON.stringify(additional_params),
      amount: amt,
      net_debited: net_debited,
      status: "Success",
      oprefno: null,
      earned: commissionAmount,
      tds: (commissionAmount / 100) * 5,
      txid: null,
      op_id: op_id,
      coordinates: coordinates,
    };
    await connection.query(
      `INSERT INTO utility (\`${Object.keys(utility).join(
        "`,`"
      )}\`) VALUES (${Object.keys(utility)
        .map((item, key) =>
          key == Object.keys(utility).length - 1 ? "?" : "?,"
        )
        .join("")})`,
      Object.values(utility)
    );
    let acno = accountno;
    if (req.query.rsa == 1) {
      acno = rsaEncryption(accountno);
    }

    const { response, url } = await recharge(
      order_id,
      acno,
      operatorApiResult.api_Id,
      amt,
      additional_params
    );
    urlG = url;

    let jsonResponse = {};
    parseString(response.data, function (err, result) {
      if (err) {
        console.error(err);
      } else {
        jsonResponse = result;
      }
    });

    if (
      (jsonResponse &&
        jsonResponse.txStatus &&
        jsonResponse.txStatus.queryStatus &&
        jsonResponse.txStatus.queryStatus[0] === "UNEXPECTED ERROR") ||
      (jsonResponse &&
        jsonResponse.recharge &&
        jsonResponse.recharge.status &&
        jsonResponse.recharge.status[0] === "FAILURE")
    ) {
      await connection.query(
        "UPDATE wallet SET wallet = ? WHERE unique_id = ?",
        [balance, unique_id]
      );
      let utility = {
        unique_id: unique_id,
        user_type: req.users.user_type,
        order_id: order_id,
        client_ref_id: client_ref_id,
        operator_name:
          operatorApiResult.operator_name + "-" + (types ? types : ""),
        customer_name,
        utility_account_no: accountno,
        ad: JSON.stringify(additional_params),
        amount: amt,
        status: "Failed",
        oprefno: null,
        earned: null,
        tds: null,
        txid: null,
        coordinates: coordinates,
        request: url,
        response: JSON.stringify(jsonResponse),
      };
      console.log(jsonResponse);

      await connection.query(
        `UPDATE utility SET ${Object.keys(utility).join(
          "= ?,"
        )}=? WHERE order_id = ?`,
        [...Object.values(utility), utility.order_id]
      );

      if (jsonResponse.recharge?.status[0] === "FAILURE") {
        return res.status(200).send({
          status: jsonResponse.recharge.status[0],
          statuscode: "02",
          amount: amt,
          errorMsg: jsonResponse.recharge.errorMsg[0],
        });
      } else if (jsonResponse.txStatus?.queryStatus[0] === "UNEXPECTED ERROR") {
        return res.status(200).send({
          status: jsonResponse.txStatus.queryStatus[0],
          statuscode: "02",
          amount: amt,
          errorMsg: jsonResponse.txStatus.errorMsg[0],
        });
      }
    } else {
      if (
        (jsonResponse &&
          jsonResponse.recharge &&
          jsonResponse.recharge.status &&
          jsonResponse.recharge.status[0] === "SUCCESS") ||
        (jsonResponse &&
          jsonResponse.recharge &&
          jsonResponse.recharge.status &&
          jsonResponse.recharge.status[0] === "SUCCESSPENDING")
      ) {
        let utility = {
          unique_id: unique_id,
          user_type: req.users.user_type,
          order_id: order_id,
          client_ref_id: client_ref_id,
          operator_name:
            operatorApiResult.operator_name + "-" + (types ? types : ""),
          customer_name,
          utility_account_no: accountno,
          ad: JSON.stringify(additional_params),
          amount: amt,
          status: "Success",
          oprefno: jsonResponse.recharge.opRefNo[0],
          earned: commissionAmount,
          tds: (commissionAmount / 100) * 5,
          txid: jsonResponse.recharge.txId[0],
          coordinates: coordinates,
          request: url,
          response: JSON.stringify(jsonResponse),
        };
        let [[max_tran_id]] = await connection.query(
          "SELECT MAX(`tran_id`) AS max_tran_id FROM walletsummary"
        );
        let tran_id = max_tran_id.max_tran_id;
        tran_id = parseInt(tran_id) + 1;
        const walletSummary = {
          unique_id: unique_id,
          tran_id: tran_id,
          type: "DR",
          amount: newAmount,
          status: "Success",
          description: `For ${operatorApiResult.operator_name} ${
            operatorApiResult.category
          } With Rs.${newAmount.toFixed(2)}/- ${accountno}`,
          closing_balance: holdbalance,
        };
        await connection.query(
          `INSERT INTO walletsummary (\`${Object.keys(walletSummary).join(
            "`,`"
          )}\`) VALUES (${Object.keys(walletSummary)
            .map((item, key) =>
              key == Object.keys(walletSummary).length - 1 ? "?" : "?,"
            )
            .join("")})`,
          Object.values(walletSummary)
        );
        await connection.query(
          `UPDATE utility SET ${Object.keys(utility).join(
            "= ?,"
          )}=? WHERE order_id = ?`,
          [...Object.values(utility), utility.order_id]
        );
        return res.status(200).send({
          status: "success",
          statuscode: "01",
          amount: amt,
          order_id: order_id,
          oprefno: jsonResponse.recharge.opRefNo[0],
        });
      }
    }
  } catch (error) {
    console.log(error);
    let utility = {
      unique_id: unique_id,
      user_type: req.users.user_type,
      order_id: order_id,
      client_ref_id: client_ref_id,
      operator_name: operator_api_result.operator_name,
      utility_account_no: accountno,
      ad: JSON.stringify(additional_params),
      amount: amt,
      status: "Failed",
      oprefno: null,
      earned: null,
      tds: null,
      txid: null,
      coordinates: coordinates,
      request: urlG,
      response: responseG,
    };
    await connection.query(
      `UPDATE utility SET ${Object.keys(utility).join(
        "= ?,"
      )}=? WHERE order_id = ?`,
      [...Object.values(utility), utility.order_id]
    );
    return res.status(500).send({
      status: "fail",
      statuscode: "02",
      message: "Something went wrong!",
    });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.get("/utility-history", TokenAuth, async (req, res) => {
  let limit = req.query.limit ? parseInt(req.query.limit) : 10;
  let page = req.query.page ? parseInt(req.query.page) : 1;

  const connection = await poolPromise().getConnection();

  try{
    
  const [totalRecords] = await connection.query(
    `SELECT COUNT(*) AS totalRecords FROM utility WHERE unique_id = ?`,
    [req.users.unique_id]
  );

  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(totalRecords[0].totalRecords / limit);

  const [utilityHistory] = await connection.query(
    `SELECT operator.icon, operator.category, utility.* FROM utility JOIN operator ON utility.op_id = operator.op_id WHERE utility.unique_id = ? ORDER BY \`date\` DESC
   LIMIT ? OFFSET ?`,
    [req.users.unique_id, limit, offset]
  );

  const updatedData = (item) => {
    const utcTimestamp = item.date;
    const localDate = moment
      .utc(utcTimestamp)
      .local()
      .format("YYYY-MM-DD HH:mm:ss");

    console.log("Local Date:", localDate);
    return {
      order_id: item.order_id,
      date: localDate,
      category: item.category,
      icon: item.icon,
      operator_name: item.operator_name,
      customer_name: item.customer_name,
      utility_account_no: item.utility_account_no,
      amount: item.amount,
      status: item.status,
      oprefno: item.oprefno,
      earn: item.earned,
    };
  };
  return res.status(200).send({
    status: "success",
    statusCode: "01",
    data: {
      totalRecords: totalRecords[0].totalRecords,
      totalPages: totalPages,
      currentPage: page,
      utilityHistory: utilityHistory.map((item) => updatedData(item)),
    },
  });
  }finally {
    if (connection) {
      await connection.release();
    }
  }


});

router.get("/utility-history/:orderid", TokenAuth, async (req, res) => {
  if (isEmpty(req.params.orderid)) {
    return res.status(500).send({
      status: "fail",
      statusCode: "02",
      message: "Please provide order id",
    });
  }
  const connection = await poolPromise().getConnection();

  const [utilityHistory] = await connection.query(
    `SELECT operator.icon,utility.* FROM utility JOIN operator ON utility.op_id = operator.op_id WHERE utility.unique_id = ? AND utility.order_id = ?`,
    [req.users.unique_id, req.params.orderid]
  );
  console.log({ utilityHistory });
  if (isEmpty(utilityHistory)) {
    await connection.release();
    return res.status(500).send({
      status: "fail",
      statusCode: "02",
      message: "No records found",
    });
  }

  // const updatedData = (item) => {
  //   const utcTimestamp = item.date;
  //   const localDate = moment
  //     .utc(utcTimestamp)
  //     .local()
  //     .format("YYYY-MM-DD HH:mm:ss");
  //   return {
  //     order_id: item.order_id,
  //     client_ref_id: item.client_ref_id,
  //     date: localDate,
  //     icon: item.icon,
  //     operator_name: item.operator_name,
  //     utility_account_no: item.utility_account_no,
  //     amount: item.amount,
  //     status: item.status,
  //   };
  // };
  const updatedData = (Arr) =>
    Arr.map((item) => {
      const utcTimestamp = item.date;
      const localDate = moment
        .utc(utcTimestamp)
        .local()
        .format("YYYY-MM-DD HH:mm:ss");
      return {
        order_id: item.order_id,
        date: localDate,
        icon: item.icon,
        operator_name: item.operator_name,
        utility_account_no: item.utility_account_no,
        amount: item.amount,
        status: item.status,
        oprefno: item.oprefno,
        earn: item.earned,
      };
    });
  
  await connection.release();
  return res.status(200).send({
    status: "success",
    statusCode: "01",
    data: updatedData(utilityHistory),
  });
});

router.get("/status-check/:orderId", TokenAuth, async (req, res) => {
  const parseString = require("xml2js").parseString;

  const connection = await poolPromise().getConnection();

  try{
    
// chaged
  const [utilityHistory] = await connection.query(
    `SELECT operator.icon,utility.* FROM utility JOIN operator ON utility.op_id = operator.op_id WHERE utility.unique_id = ? AND utility.order_id = ?`,
    [req.users.unique_id, req.params.orderId]
  );
  console.log(utilityHistory[0].status);

  if (isEmpty(utilityHistory)) {
    return res.status(500).send({
      status: "fail",
      statusCode: "02",
      message: "No records found",
    });
  }
  // added condition
  if (utilityHistory[0].status === "Failed" || utilityHistory[0].status === "Refund") {
    return res.status(200).send({
      status: "success",
      statusCode: "01",
      data: {
        order_id: utilityHistory[0].order_id,
        date: moment.utc(utilityHistory[0].date).local().format("YYYY-MM-DD HH:mm:ss"),
        icon: utilityHistory[0].icon,
        operator_name: utilityHistory[0].operator_name,
        utility_account_no: utilityHistory[0].utility_account_no,
        amount: utilityHistory[0].amount,
        status: utilityHistory[0].status,
        oprefno: utilityHistory[0].oprefno,
        massage:`Your Recharge is ${utilityHistory[0].status}`
      },
    });
  }

  const response = await statusCheck(req.params.orderId);
  
  console.log("response.data",response.data,"response.data");

  let jsonResponse = {};
  parseString(response.data, function (err, result) {
    if (err) {
      console.error(err);
    } else {
      jsonResponse = result;
    }
  });
  console.log("response.data",jsonResponse,"response.data")// console.log(jsonResponse);
  if (isEmpty(response)) {
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Data not found",
    });
  }

// changed 

  const updatedData = (Arr) =>
    Arr.map((item) => {
      const utcTimestamp = item.date;
      const localDate = moment
        .utc(utcTimestamp)
        .local()
        .format("YYYY-MM-DD HH:mm:ss");
      return {
        order_id: item.order_id,
        date: localDate,
        icon: item.icon,
        operator_name: item.operator_name,
        utility_account_no: item.utility_account_no,
        amount: item.amount,
        status: item.status,
        oprefno: item.oprefno,
      };
    });
 //changed queryStatus[0] to  status[0]  
 //jsonResponse.txStatus?.queryStatus[0]?.toString().includes("FAILURE") to jsonResponse.txStatus?.status[0]?.toString().includes("RECHARGEFAILURE")
  if (jsonResponse.txStatus?.status[0]?.toString().includes("RECHARGEFAILURE")) {
    const [[result]] = await connection.query(
      "SELECT * FROM utility JOIN wallet ON wallet.unique_id = utility.unique_id WHERE utility.order_id = ? ",
      [req.params.orderId]
    );

    let utility = {
      unique_id: result.unique_id,
      user_type: req.users.user_type,
      order_id: result.order_id,
      client_ref_id: result.client_ref_id,
      operator_name: result.operator_name,
      utility_account_no: result.utility_account_no,
      ad: JSON.stringify(result.ad),
      amount: result.amount,
      status: "Refund", //"Failed" to Refund
      oprefno: null,
      earned: null,
      tds: null,
      txid: null,
      coordinates: result.coordinates,
      // request: urlG,
      // response: responseG,
      refunded: result.net_debited,
      status_check_response: JSON.stringify(jsonResponse),
    };
    await connection.query(
      `UPDATE utility SET ${Object.keys(utility).join(
        "= ?,"
      )}=? WHERE order_id = ?`,
      [...Object.values(utility), req.params.orderId]
    );
    //added
    await connection.query(
      "UPDATE wallet SET wallet = wallet + ? WHERE unique_id = ? ",
      [result.net_debited, result.unique_id]
    );

    const [results] = await connection.query(
      "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummary"
    );

    var tran_id_ = results[0].max_tran_id || 0;
    var tran_id_w_ = tran_id_ + 1;
    var description_ = `Your Recharge is faild amount Refunded Rs${result.net_debited}/-`;

    const [update_wallet] = await connection.query(
      "SELECT * FROM wallet WHERE unique_id = ?",
      [result.unique_id]
    );

    await connection.query(
      "INSERT INTO walletsummary (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        result.unique_id,
        tran_id_w_,
        "CR",
        result.net_debited,
        "Success",
        description_,
        update_wallet[0].wallet,
      ]
    );


    return res.status(200).send(updatedData(utilityHistory)[0]);
  }

  if (jsonResponse.txStatus.queryStatus[0] == "SUCCESS") {
    let utility = {
      status: "SUCCESS",
      oprefno: jsonResponse.txStatus.operatorrefno[0],
      refunded: 0,
      status_check_response: JSON.stringify(jsonResponse),
    };
    await connection.query(
      `UPDATE utility SET ${Object.keys(utility).join(
        "= ?,"
      )}=? WHERE order_id = ?`,
      [...Object.values(utility), req.params.orderId]
    );
    return res.status(200).send({
      status: "success",
      statusCode: "01",
      data: updatedData(utilityHistory),
    });
  } else {
    let utility = {
      status: "Failed",
      earned: null,
      tds: null,
      net_debited: null,
      refunded: 0,
      status_check_response: JSON.stringify(jsonResponse),
    };
    await connection.query(
      `UPDATE utility SET ${Object.keys(utility).join(
        "= ?,"
      )}=? WHERE order_id = ?`,
      [...Object.values(utility), req.params.orderId]
    );
    return res.status(200).send({
      status: "success",
      statusCode: "01",
      data: updatedData(utilityHistory),
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

router.post("/add-complaint", TokenAuth, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const { txId, reason, description } = req.body;

  try{
    const [[complaint_check]] = await connection.query(
      "SELECT * FROM complaint WHERE txId = ? ",
      [txId]
    );
  
    if (!isEmpty(complaint_check)) {
      return res.status(200).json({
        status: "failed",
        statuscode: "02",
        msg: "Complaint alredy resistered",
      });
    }
  
    const complaint = {
      txId,
      reason,
      description,
      unique_id: req.users.unique_id,
      customer_name: req.users.name,
    };
  
    const columns = Object.keys(complaint)
      .map((key) => `\`${key}\``)
      .join(",");
    const placeholders = Object.values(complaint)
      .map(() => "?")
      .join(",");
  
    const query = `INSERT INTO complaint (${columns}) VALUES (${placeholders})`;
    const values = Object.values(complaint);
  
    await connection.query(query, values);
  
    return res.status(200).json({
      status: "success",
      statuscode: "01",
      msg: "Complaint resistered successfully",
    });
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

router.get("/get-complaints/:complaintId?", TokenAuth, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try{
    let query = "SELECT * FROM complaint WHERE unique_id = ? ";
  const queryValues = [req.users.unique_id];
  if (req.params.complaintId) {
    query += " AND id = ? ";
    queryValues[1] = req.params.complaintId;
  }

  const [results] = await connection.query(query, queryValues);

  if (isEmpty(results)) {
    return res.status(500).json({
      status: "failed",
      statuscode: "02",
      message: "Data not found",
    });
  }
  return res.status(200).json({
    status: "success",
    statuscode: "01",
    data: results.map(
      ({
        id,
        txId,
        customer_name,
        reason,
        description,
        status,
        remark,
        ...elem
      }) => ({
        id,
        txId,
        customer_name,
        reason,
        description,
        remark,
        status,
      })
    ),
  });
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

const createTree = (data) => {
  const tree = [];
  // Create a dictionary to store references to each node by its ID
  const nodes = {};
  // Build the initial tree structure with empty children arrays
  data.forEach((item) => {
    delete item.user_type;
    delete item.status;
    nodes[item.id] = {
      ...item,
      id: item.treeview == "True" ? "" : item.id,
      children: [],
    };
  });

  // Iterate over the nodes and assign each node as a child to its parent
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
};

const calculateExpiry = (createdDate, days) => {
  const createdDatetime = new Date(createdDate);
  const expiryDatetime = new Date(
    createdDatetime.getTime() + days * 24 * 60 * 60 * 1000
  );
  const currentDate = new Date();
  if (expiryDatetime > currentDate) {
    const expiryDate = expiryDatetime.toISOString().split("T")[0];
    return expiryDate;
  } else {
    return "Expired";
  }
};

const rsaEncryption = (cn) => {
  const publicKey = `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz3WXL7tDSfUG6hfqTADnWXzSB4ndgsbQYnVuIV23FWpwzS/ZPC27rxTcOHPoh7NERAYmIUL0xlKhwqalyGvYx5Uvj7gJ6W6oF9t1dvsNU4p4kxBh5DUfKQ/DfAc1qiY70Dm88QPW3OYitEVAO64zS++PqZllegz/vHxsThdVfM6/43XCjLKBkmD+kCYk3Nu7DhA2GZp0VGo4BkKlklT7Yejs7VHs9Z4lfiwxlPZPWN99i3twUD1PdjqNd0eKwb5LOpOXdAw7kKZ1nI8+IAaXtPEEAbeDRzw8DIfwAMs++ruSaB6g+FVN0XAD2LJCNN+Fqb999Lf2OV3PiVdXxJpWTwIDAQAB`;
  // Encrypt the message
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING, // Use PKCS1 padding
    },
    Buffer.from(cn)
  );
  const encryptedData = encrypted.toString("base64");
  return encryptedData;
};

module.exports = router;
