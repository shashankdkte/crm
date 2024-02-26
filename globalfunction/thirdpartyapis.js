const request = require("request");
const crypto = require("crypto");
const poolPromise = require("../util/connectionPromise");
const axios = require("axios");

async function keyValues() {
  const connection = await poolPromise().getConnection();
  const prover_name = "eko";
  const [[keys]] = await connection.query(
    "SELECT * FROM vender_key WHERE prover_name = ?",
    [prover_name]
  );
  const developer_key = keys.value;
  const key = keys.value_1;
  const encodedKey = Buffer.from(key).toString("base64");
  const Timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", encodedKey)
    .update(Timestamp)
    .digest("binary");
  const secretKey = Buffer.from(signature, "binary").toString("base64");
  return { secretKey, Timestamp, developer_key };
}

const thirdpartyapis = async (mobile_no, api_name) => {
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/mobile_number:${encodeURIComponent(
        mobile_no
      )}?initiator_id=9830299198&user_code=31739001`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
    };

    request(options, async function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        const eko_api_log = {
          timestamp: keymap.Timestamp,
          api_name: api_name,
          request: JSON.stringify(options),
          response: JSON.stringify(responseBody),
        };
        resolve({ ...responseBody, eko_api_log });
      }
    });
  });
};

const thirdresendverify = async (req) => {
  const { mobile_no } = req.body;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "POST",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/mobile_number:${mobile_no}/otp`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        pipe: "9",
        user_code: "31739001",
      },
    };
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        resolve(responseBody);
      }
    });
  });
};

const thirdcreateremitter = async (req, api_name) => {
  const { mobile_no, name, dob, address } = req.body;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "PUT",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/mobile_number:${mobile_no}`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        user_code: "31739001",
        name: name,
        dob: dob,
        residence_address: JSON.stringify(address),
        pipe: "9",
      },
    };
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        const eko_api_log = {
          timestamp: keymap.Timestamp,
          api_name: api_name,
          request: JSON.stringify(options),
          response: JSON.stringify(responseBody),
        };
        resolve({ ...responseBody, eko_api_log });
      }
    });
  });
};

const thirdverification = async (req, api_name) => {
  const { mobile_no, otp_ref_id, otp } = req.body;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "PUT",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/verification/otp:${otp}`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        id_type: "mobile_number",
        id: mobile_no,
        otp_ref_id: otp_ref_id,
        user_code: "31739001",
        pipe: "9",
      },
    };

    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        const eko_api_log = {
          timestamp: keymap.Timestamp,
          api_name: api_name,
          request: JSON.stringify(options),
          response: JSON.stringify(responseBody),
        };
        resolve({ ...responseBody, eko_api_log });
      }
    });
  });
};

const thirdgetrecipient = async (mobile_no) => {
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "GET",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/mobile_number:${mobile_no}/recipients?initiator_id=9830299198&user_code=31739001`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
      },
    };
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        resolve(responseBody);
      }
    });
  });
};

const thirdverifiedaccount = async (resp) => {
  const { client_ref_id, mobile_no, account, ifsc } = resp;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "POST",
      url: `https://api.eko.in:25002/ekoicici/v2/banks/ifsc:${ifsc}/accounts/${account}`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        customer_id: mobile_no,
        client_ref_id: client_ref_id,
        user_code: "31739001",
      },
    };

    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        console.log(responseBody);
        resolve(responseBody);
      }
    });
  });
};

const thirdAddRecipient = async (req, mobile_no, api_name) => {
  const { recipient_mobile, account, ifsc, bank_id, recipient_name } = req.body;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "PUT",
      url: `https://api.eko.in:25002/ekoicici/v2/customers/mobile_number:${mobile_no}/recipients/acc_ifsc:${account}_${ifsc}`,
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        recipient_mobile: recipient_mobile,
        bank_id: bank_id,
        recipient_type: "3",
        recipient_name: recipient_name,
        user_code: "31739001",
      },
    };
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        const eko_api_log = {
          timestamp: keymap.Timestamp,
          api_name: api_name,
          request: JSON.stringify(options),
          response: JSON.stringify(responseBody),
        };
        resolve({ ...responseBody, eko_api_log });
      }
    });
  });
};

const thirdtransactions = async (ekoparamter, api_name) => {
  const {
    time_stamp,
    remitter_id,
    recipient_id,
    coordinates,
    order_id,
    amount,
  } = ekoparamter;
  const keymap = await keyValues();
  return new Promise((resolve, reject) => {
    var options = {
      method: "POST",
      url: "https://api.eko.in:25002/ekoicici/v2/transactions",
      headers: {
        developer_key: keymap.developer_key,
        "secret-key": keymap.secretKey,
        "secret-key-timestamp": keymap.Timestamp,
        "content-type": "application/x-www-form-urlencoded",
      },
      form: {
        initiator_id: "9830299198",
        customer_id: remitter_id,
        recipient_id: recipient_id,
        amount: Number(amount),
        channel: "2",
        state: "1",
        timestamp: time_stamp,
        currency: "INR",
        latlong: coordinates,
        client_ref_id: order_id,
        user_code: "31739001",
      },
    };
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else {
        const responseBody = JSON.parse(response.body);
        const eko_api_log = {
          timestamp: keymap.Timestamp,
          api_name: api_name,
          request: JSON.stringify(options),
          response: JSON.stringify(responseBody),
        };
        resolve({ ...responseBody, eko_api_log });
      }
    });
  });
};

const fetchConnectionDetails = async (cn) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://rapi.mobikwik.com/recharge/infobip/getconnectiondetails?cn=${cn}`,
    headers: {
      "Content-Type": "application/json",
      "X-MClient": "14",
      Cookie:
        "__cf_bm=3nNn749Afr_aZmALixQtJrG31_Rd6Plk47R2eHcg.yc-1686935808-0-AQUXN/x7axoHyGcGi5Rawe7HfvYK9AAd9/PMJyPjfp4Ce53vsWPjnBA8oSeXvanSpI6jn07dXk/4TqUhDUeqOYYpCmg2mBBgge+HFFLEXCOT",
    },
  };

  const response = await axios.request(config);
  return response;
};
const fetchRechargePlans = async (operator, circle = null, cn = null) => {
  try {
    let url = `https://rapi.mobikwik.com/recharge/v1/rechargePlansAPI/${operator}${
      circle ? "/" + circle : ""
    }${cn ? "?cn=" + cn : ""}`;
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        "Content-Type": "application/json",
        "X-MClient": "14",
      },
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log("fetchRechargePlans error : ", error.message);
  }
};

  
  const fetchViewBill = async (op, cn, adParams) => {
    const axios = require("axios");
    let data = JSON.stringify({
      uid: "subhojit.sadhukhan33@gmail.com",
      pswd: "Jhuma@270588",
      cn: String(cn),
      op: String(op),
      adParams: adParams,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://rapi.mobikwik.com/retailer/v2/retailerViewbill",
      headers: {
        "Content-Type": "application/json",
        "X-MClient": "14",
      },
      data: data,
    };

    const responseValue = await axios.request(config);
    return { responseValue, config };
};

const callEko = async (op,cn, adParams) => {
  const axios = require('axios');
const [secretKey, Timestamp] = getKey();
  
let data = JSON.stringify({
  "source_ip": "49.50.76.61",
  "user_code": "31739001",
  "client_ref_id": "2021053458",
  "utility_acc_no": String(cn),
  "confirmation_mobile_no": "9831693333",
  "sender_name": "anil ch Basak",
  "operator_id": String(op),
  "Latlong": "22.5751093,88.2947664",
  "hc_channel": "1",
  addParams:adParams
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://api.eko.in:25002/ekoicici/v2/billpayments/fetchbill?initiator_id=9830299198',
  headers: { 
    'developer_key': '0d13fefbdd3d507c3a1485e6694d4197', 
    'secret-key-timestamp': Timestamp, 
    'secret-key': secretKey, 
    'Content-Type': 'application/json', 
    'Connection': 'Keep-Alive', 
    'Accept-Encoding': 'gzip', 
    'User-Agent': 'okhttp/3.9.0'
  },
  data : data
};
  try
  {
  
    const response_eko = await axios.request(config);
    return {response_eko,config};
  }
  catch (error)
  {
    
    
  }

 
}
const getKey = () => {
  const key = "b977803d-0218-456e-a676-79de8c42f4b6";
  const encodedKey = Buffer.from(key).toString("base64");
  const Timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", encodedKey)
    .update(Timestamp)
    .digest("binary");
  const secretKey = Buffer.from(signature, "binary").toString("base64");
  return [ secretKey, Timestamp];
}

const statusCheck = async (txId) => {
  const uid = "admin@eg-paid.com";
  const pwd = "Admin@123";
  let url = `https://rapi.mobikwik.com/rechargeStatus.do?uid=${uid}&pwd=${pwd}&txId=${txId}`;
  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url,
    headers: {
      Cookie:
        "__cf_bm=E.PBbqjbP0vEB7NmWm01tRoZzL6i5We4LvJ05WWSuqs-1686680152-0-AddWJJMNwVWbWkZgd9xKKPG0fzyYuPoIOngd57NXpboJvZcXaBPh5PYk6SexQ0MQexf0eSds4q18yc/1cJUftYspsNp8NpaBh1FD4KawUxmb; JSESSIONID=6219CAA18FF7712014C3AA0A6F0563CA",
    },
  };
    const responseValue = await axios.request(config);
    return responseValue;
};
const recharge = async (reqid, cn, op, amt, additionalParams) => {
  const uid = "admin@eg-paid.com";
  const pwd = "Admin@123";
  let url = `https://rapi.mobikwik.com/recharge.do?uid=${uid}&pwd=${pwd}&reqid=${reqid}&cn=${cn}&op=${op}&amt=${amt}`;

  if (additionalParams) {
    const keys = Object.keys(additionalParams);
    keys.forEach((key) => {
      url += `&${key}=${additionalParams[key]}`;
    });
  }
  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url,
    headers: {
      Cookie:
        "__cf_bm=E.PBbqjbP0vEB7NmWm01tRoZzL6i5We4LvJ05WWSuqs-1686680152-0-AddWJJMNwVWbWkZgd9xKKPG0fzyYuPoIOngd57NXpboJvZcXaBPh5PYk6SexQ0MQexf0eSds4q18yc/1cJUftYspsNp8NpaBh1FD4KawUxmb; JSESSIONID=6219CAA18FF7712014C3AA0A6F0563CA",
    },
  };

  try {
    const response = await axios.request(config);

    return { response, url };
  } catch (error) {
    throw error;
  }
};
// const creditPayment = async (
//   uid,
//   pwd,
//   reqid,
//   cn,
//   op,
//   amt,
//   additionalParams
// ) => {
//   let url = `https://rapi.mobikwik.com/recharge.do?uid=${uid}&pwd=${pwd}&reqid=${reqid}&cn=${cn}&op=${op}&amt=${amt}`;

//   if (additionalParams) {
//     const keys = Object.keys(additionalParams);
//     keys.forEach((key) => {
//       url += `&${key}=${additionalParams[key]}`;
//     });
//   }

//   const config = {
//     method: "get",
//     maxBodyLength: Infinity,
//     url,
//     headers: {
//       Cookie:
//         "__cf_bm=E.PBbqjbP0vEB7NmWm01tRoZzL6i5We4LvJ05WWSuqs-1686680152-0-AddWJJMNwVWbWkZgd9xKKPG0fzyYuPoIOngd57NXpboJvZcXaBPh5PYk6SexQ0MQexf0eSds4q18yc/1cJUftYspsNp8NpaBh1FD4KawUxmb; JSESSIONID=6219CAA18FF7712014C3AA0A6F0563CA",
//     },
//   };

//   try {
//     const response = await axios.request(config);
//     return { response, url };
//   } catch (error) {
//     throw error;
//   }
// };
const validate = async (cn, op, amt, additionalParams) => {
  const axios = require("axios");
  const key = "5DYJS4686C79M48QT68M6QLDFFT2TY25";
  let uid = "recharge-support@mobikwik.com";
  let pwd = "123@Recharge@321";
  let data = JSON.stringify({
    uid: uid,
    password: pwd,
    amt: amt,
    cn: cn,
    op: String(op),
    adParams: additionalParams,
  });
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(data);
  const hash = hmac.digest("base64");
  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://rapi.mobikwik.com/recharge/v1/retailerValidation",
    headers: {
      checkSum: hash,
      "X-MClient": "14",
      "Content-Type": "application/json",
      Cookie:
        "__cf_bm=3mphn0Ws4BdOeM4HOa12l_WlTt445z5r_NbRCJliVd4-1687197720-0-ATdwtAuFQz1sKHWNWD75fg/jzkS2jxVr5ZHcweVSThIYs9jkr/6weavXyNMv6mqItKgAPLxNNnNgOsTQKqKcXZUzwq9Yd+8TJ+zRsCG9mjNB; JSESSIONID=F8E5DFA902CC91CB9C70D5B6CECD4505",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    return response;
  } catch (error) {
    throw error;
  }
};
// const cCheck = async () => {
//   const baseURL = "https://rapi.mobikwik.com/recharge.do";
//   const uid = "recharge-support@mobikwik.com";
//   const pwd = "123@Recharge@321";
//   const cn =
//     "CodXQVbBZSNnnYcx+chtW3h8ejZlLOyq9zczFA28Ed2BmNh+RDQO4qcp/MhZ9HJhUHoKMYGhdCeZUqQdol3MgpbSpFko63hNyI5FFvVaposfEe3cbN+u9HziWfM2yKY9/YNnxC6+eOmBvVN6X2y5kMuq9GddH3ibnQbY2jlfYKZTgXYzsyi0LpvvQko2q/mmJH5zKpeA6CGPplgF9hCO7EbkyZZJQpvvyT50mAVidhVoq/j2NIdYVjVVYrm5Jm7bRBYmZ0UZfUdJ8ZdbqmuAWLZq2u7B/IT20xtYu9+JnsMv370v2Cmi4NsWMbcw+DFmdvrq8Ryfah5w1HC9uqMIA==";
//   const op = "208";
//   const cir = "0";
//   const amt = "10";
//   const reqid = "1123f45";

//   // Construct the URL using the variables
//   const url = `${baseURL}?uid=${encodeURIComponent(
//     uid
//   )}&pwd=${encodeURIComponent(pwd)}&cn=${encodeURIComponent(
//     cn
//   )}&op=${encodeURIComponent(op)}&cir=${encodeURIComponent(
//     cir
//   )}&amt=${encodeURIComponent(amt)}&reqid=${encodeURIComponent(reqid)}`;

//   // let url = `https://alpha3.mobikwik.com/recharge.do?uid=${uid}&pwd=${pwd}&reqid=${reqid}&cn=${cn}&op=${op}&amt=${amt}`;
//   // let url = `https://alpha3.mobikwik.com/rechargeStatus.do?uid=${uid}&pwd=${pwd}&txId=${txId}`;

//   const config = {
//     method: "get",
//     maxBodyLength: Infinity,
//     url,
//     headers: {
//       Cookie:
//         "__cf_bm=E.PBbqjbP0vEB7NmWm01tRoZzL6i5We4LvJ05WWSuqs-1686680152-0-AddWJJMNwVWbWkZgd9xKKPG0fzyYuPoIOngd57NXpboJvZcXaBPh5PYk6SexQ0MQexf0eSds4q18yc/1cJUftYspsNp8NpaBh1FD4KawUxmb; JSESSIONID=6219CAA18FF7712014C3AA0A6F0563CA",
//     },
//   };

//   try {
//     const response = await axios.request(config);
//     return response;
//   } catch (error) {
//     throw error;
//   }
// };

module.exports = {
  thirdpartyapis,
  thirdresendverify,
  thirdcreateremitter,
  thirdverification,
  thirdgetrecipient,
  thirdverifiedaccount,
  thirdAddRecipient,
  thirdtransactions,
  fetchRechargePlans,
  fetchConnectionDetails,
  statusCheck,
  fetchViewBill,
  recharge,
  validate,
  callEko
};
