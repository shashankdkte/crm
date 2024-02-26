const axios = require("axios");
const poolPromise = require("../util/connectionPromise");
const qs = require('qs');


var smsfunction = async (mobile,template_id , message) => {

  const connection = await poolPromise().getConnection();
  console.log(mobile,"mobile")
  try {

    //sms_gateway
    const sq2 = "SELECT * FROM sms_gateway WHERE `status` = ?";
    const value2 = ['Enable'];
    const [smsgateway] = await connection.query(sq2, value2);
    console.log("smsgateway",smsgateway,"smsgateway")
    const type = smsgateway[0].type;
    const api_url = smsgateway[0].api_url;
    const key = smsgateway[0].key;
    const sender_id = smsgateway[0].sender_id;
    const peid = smsgateway[0].peid;
    //sms_gateway


    let data = qs.stringify({
      'module': 'TRANS_SMS',
      'apikey': key,
      'to': mobile,
      'from': sender_id,
      'msg': message,
      'peid': peid,
      'ctid': template_id 
    });
    
    let config = {
      method: type,
      maxBodyLength: Infinity,
      url: api_url,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data : data
    };
    
    axios.request(config)
    .then(async(response) => {
      console.log(JSON.stringify(response.data));
      const [smshistoryRows] = await connection.execute(
        "INSERT INTO sms_history (request, response, status, status_code) VALUES (?, ?, ?, ?)",
        [
          JSON.stringify(config),
          JSON.stringify(response.data),
          response.data.Status,
          response.data.Details
        ]
      );
      return JSON.stringify(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
  
  } catch (err) {
    console.log("smsfunction error: ", err);
  }finally{
    await  connection.release();
  }
};

module.exports = {smsfunction};
