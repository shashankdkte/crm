const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const TokenAuth = require("../globalfunction/TokenAuth.js");
const path = require("path");
const fs = require("fs");
var FCM = require('fcm-node');

router.post("/fcm-token", TokenAuth, async (req, res) => {
    const {fcm_token } = req.body;
    const unique_id = req.users.unique_id;
    if (!fcm_token) {
        return res.status(200).json({
            statuscode: "2",
            status: "failed",
            message: "FCM Token Required",
          });
    }
    const connection = await poolPromise().getConnection();
   
  
    const [fcmToken ] = await connection.query(
        "UPDATE users SET fcm_token = ? WHERE unique_id = ?", 
        [fcm_token , unique_id]
      );

      if (fcmToken.affectedRows === 0) {
        connection.release();
        return res.status(400).json({
          statuscode: "2",
            status: "failed",
            message: "Invalid Data",
          });
      } else {
        return res.status(200).json({
          statuscode: "1",
            status: "success",
            message: "FMC token Updated",
        });
      }
  });

router.post("/send-notification", TokenAuth, async (req, res) => {
    const { message, fcmtokens, title } = req.body;
  
    if (!message || !title || !fcmtokens || fcmtokens.length === 0) {
        return res.status(200).json({
            status: "failed",
            statuscode: "02",
            message: "Message, title, and at least one FCM token are Required",
        });
    }

    const sendPushNotification = async (message, fcmtokens, title) => {
        try {
            
            //Firebase config
            fs.readFile(path.join(__dirname,'../config/FireBaseConfig.json'), "utf8", async(err, jsonString) => {
              if (err) {
                  console.log("Error reading file from disk:", err);
                  return err;
                }

              //Firebase config
              const data = JSON.parse(jsonString);
              var serverKey = data.SERVER_KEY;
              var fcm = new FCM(serverKey);

            var pushMessage = {
                registration_ids: fcmtokens, // fcmtokens must be array
                notification: {
                    title: title,
                    body: message,
                    icon : path.join(__dirname, '../assets/image/userdocs/default-user.png')
                },
                // android: {
                //   notification: {
                //     imageUrl: 'https://res.cloudinary.com/dygfqcdgo/image/upload/t_egpaidicon/v1704548364/bhouysj2hveyr6lhtztj.jpg'
                //   }
                // },
                // apns: {
                //   payload: {
                //     aps: {
                //       'mutable-content': 1
                //     }
                //   },
                //   fcm_options: {
                //     image: 'https://res.cloudinary.com/dygfqcdgo/image/upload/t_egpaidicon/v1704548364/bhouysj2hveyr6lhtztj.jpg'
                //   }
                // },
                // webpush: {
                //   headers: {
                //     image: 'https://res.cloudinary.com/dygfqcdgo/image/upload/t_egpaidicon/v1704548364/bhouysj2hveyr6lhtztj.jpg'
                //   }
                // },
                // topic: "test",
            };
            
            fcm.send(pushMessage, function (err, response) {
                if (err) {
                    console.log("Something has gone wrong!", err);
                    return res.status(200).json({
                        status: "failed",
                        statuscode: "02",
                        error: err,
                    });
                } else {
                    console.log("Push notification sent.", response);
                    return res.status(200).json({
                        status: "success",
                        statuscode: "01",
                        response: response,
                    });
                }
            });
        
          });
          } catch (error) {
            console.log(error);
            return res.status(200).json({
                status: "failed",
                statuscode: "02",
                error: error,
            });
        }
    };

    sendPushNotification(message, fcmtokens, title);
});

router.get("/get-notification", TokenAuth, async (req, res) => {
  const customer_id = req.users.customer_id;
  const connection = await poolPromise().getConnection();
 try{
  const [notification] = await connection.query(
    'SELECT notify_id AS msg_id ,title, message FROM notification WHERE status = "Pending" AND `to` = ? ', 
    [customer_id ]
    );
    return res.status(200).json({
      status_code: 1,
      status: 'success',
      data: notification
    })
 }catch (error) {
  console.error(error);
  res.status(500).json({ status_code: 1, status: 'failed', message: 'Something went wrong' });
} finally {
  await connection.release();
}
 
});

router.post('/update-notification-status', TokenAuth, async (req, res) => {
  const customer_id = req.users.customer_id;
  const { msg_id, status } = req.body;
  const connection = await poolPromise().getConnection();
 try{
  const [notification] = await connection.query(
    'UPDATE notification SET status = ? WHERE status = "Pending" AND notify_id = ?', 
    [status, msg_id]
    );
    return res.status(200).json({
      status_code: 1,
      status: 'success',
      message: 'Status Update Successful' 
    })
 }catch (error) {
  console.error(error);
  res.status(500).json({ status_code: 1, status: 'failed', message: 'Something went wrong' });
} finally {
  await connection.release();
}
 
});




module.exports = router;