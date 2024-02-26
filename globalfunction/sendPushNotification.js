const path = require("path");
const fs = require("fs");
var FCM = require('fcm-node');

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
           
        };
        
        fcm.send(pushMessage, function (err, response) {
            if (err) {
                console.log("Something has gone wrong!", err);
                return err;
            } else {
                console.log("Push notification sent.", response);
                return response;
            }
        });
    
      });
      } catch (error) {
        console.log(error);
        return {
            status: "failed",
            statuscode: "02",
            error: error,
        };
    }
};


module.exports = { sendPushNotification };