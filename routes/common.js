const express = require("express");
const axios = require("axios");
const router = express.Router();
const poolPromise = require("../util/connectionPromise");
const fetch = require("node-fetch");
const { isEmpty } = require("lodash"); 

// router.get("/pincode/:pincode", async (req, res) => {
//   const pincode = req.params.pincode;
//   if (!pincode || pincode.length < 6 || pincode.length > 6) {
//     return res
//       .status(422)
//       .json({ status: "fail", message: "Please provide 6 digit pincode" });
//   }

//   const connection = await poolPromise().getConnection();

//   try {
//     const sql = "SELECT * FROM area WHERE pincode = ?";
//     const value = [pincode];
//     const [area] = await connection.query(sql, value);

//     if (area.length === 0) {
//       return res.status(500).json({
//         status: "success",
//         statuscode: "01",
//         data: [
//           {
//             area_name: "null",
//             division: "null",
//             region: "null",
//             block: "null",
//             district: "null",
//             state: "null",
//           },
//         ],
//         });
//       axios
//         .get("https://api.postalpincode.in/pincode/" + pincode)
//         .then(async (response) => {
//           const [data] = response.data;
//           // console.log(data);
//           if (data) {
//             let arr = data.PostOffice;
//             // console.log({ arr });
//             if (arr === null) {
//               return res.status(401).send({
//                 Message: "No records found",
//                 Status: "Error",
//                 PostOffice: null,
//               });
//             }
//             let sql = `INSERT INTO area (
//              name,
//              district,
//              division,
//              region,
//              block,
//              state,
//              pincode
//            )
//            VALUES `;

//             sql += arr
//               .map((postOffice) => {
//                 return `("${postOffice.Name}", "${postOffice.District}", "${postOffice.Division}", "${postOffice.Region}", "${postOffice.Block}", "${postOffice.State}", "${postOffice.Pincode}")`;
//               })
//               .join(", ");

//             await connection.query(sql);
//             console.log("data saved");
//             return res.status(200).send({
//               status: "success",
//               statuscode: "01",
//               data: arr.map(
//                 ({ Name, District, Division, Region, Block, State }) => ({
//                   area_name: Name,
//                   division: Division,
//                   region: Region,
//                   block: Block,
//                   district: District,
//                   state: State,
//                 })
//               ),
//             });
//           }
//         })
//         .catch(async (err) => {
//           console.log(err);
//           return res.status(500).json({
//             status: "success",
//             statuscode: "01",
//             data: [
//               {
//                 area_name: "null",
//                 division: " ",
//                 region: " ",
//                 block: " ",
//                 district: " ",
//                 state: " ",
//               },
//             ],
//           });
//         });
//     } else {
//       return res.status(200).send({
//         status: "success",
//         statuscode: "01",
//         data: area.map(
//           ({ name, district, division, region, block, state }) => ({
//             area_name: name,
//             division,
//             region,
//             block,
//             district,
//             state,
//           })
//         ),
//       });
//     }
//   } catch (err) {
//     console.log("error", err);
//     return res.status(422).json({ status: "fail", error: err });
//   } finally {
//     await connection.release();
//   }
// });

router.get("/pincode/:pincode", async (req, res) => {
  const pincode = req.params.pincode;
  if (!pincode || pincode.length < 6 || pincode.length > 6) {
    return res
      .status(422)
      .json({ status: "fail", message: "Please provide 6 digit pincode" });
  }

  const connection = await poolPromise().getConnection();

  try {
    const sql = "SELECT * FROM area WHERE pincode = ?";
    const value = [pincode];
    const [area] = await connection.query(sql, value);

    if (area.length === 0) {
      axios
        .get("https://api.postalpincode.in/pincode/" + pincode) 
        .then(async (response) => {
          const [data] = response.data; 
          // console.log(data);
          if (data) {
            let arr = data.PostOffice;
            // console.log({ arr });
            if (arr === null) {
              return res.status(401).send({
                Message: "No records found",
                Status: "Error",
                PostOffice: null,
              });
            }
            let sql = `INSERT INTO area (
             name,
             district,
             division,
             region,
             block,
             state,
             pincode
           )
           VALUES `;

            sql += arr
              .map((postOffice) => {
                return `("${postOffice.Name}", "${postOffice.District}", "${postOffice.Division}", "${postOffice.Region}", "${postOffice.Block}", "${postOffice.State}", "${postOffice.Pincode}")`;
              })
              .join(", ");

            await connection.query(sql);
            console.log("data saved");
            return res.status(200).send({
              status: "success",
              statuscode: "01",
              data: arr.map(
                ({ Name, District, Division, Region, Block, State }) => ({
                  area_name: Name,
                  division: Division,
                  region: Region,
                  block: Block,
                  district: District,
                  state: State,
                })
              ),
            });
          }
        });
    } else {
      return res.status(200).send({
        status: "success",
        statuscode: "01",
        data: area.map(
          ({ name, district, division, region, block, state }) => ({
            area_name: name,
            division,
            region,
            block,
            district,
            state,
          })
        ),
      });
    }
  } catch (err) {
    console.log("error", err);
    return res.status(422).json({ status: "fail", error: err });
  } finally {
    await connection.release();
  }
});

router.post("/getGeolocation", async (req, res) => {
  const { coordinates } = req.body;
  console.log("coordinates", coordinates);

  const connection = await poolPromise().getConnection();
  try {

    const sql = "SELECT * FROM geolocation WHERE coordinates = ?";
    const value = [coordinates];
    const [geolocation] = await connection.query(sql, value);

    if (geolocation.length === 0) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates}&sensor=false&key=AIzaSyCrdAWMU82Eoed3o3WU5lu_0Q6aJFfrdl0`;
      console.log("url", url);

      const settings = { method: "POST" };
      const response = await fetch(url, settings);
      const location = await response.json();
      console.log({ location });

      if (location.status === "OK") {
        let result = location.results[0];
        const addressComponents = result.address_components;

        const formatted_address = result.formatted_address;
        const city = addressComponents.find((component) =>
          component.types.includes("locality")
        ).long_name;
        const state = addressComponents.find((component) =>
          component.types.includes("administrative_area_level_1")
        ).long_name;
        const pincode = addressComponents.find((component) =>
          component.types.includes("postal_code")
        ).long_name;

        const sql1 = `INSERT INTO geolocation (coordinates, address, area, district, pincode, state) VALUES (?, ?, ?, ?, ?, ?)`;
        const value1 = [
          coordinates,
          formatted_address,
          city,
          city,
          pincode,
          state,
        ];
        await connection.query(sql1, value1);

        res.json({
          status: "success",
          message: "Geolocation Address",
          coordinates,
          address: formatted_address,
          area: city,
          district: city,
          pincode,
          state,
        });
      } else {
        throw new Error("Geocode not found");
      }
    } else {
      const geolocationData = geolocation[0];
      res.json({
        status: "success",
        message: "Geolocation address found in db",
        coordinates,
        address: geolocationData.address,
        area: geolocationData.area,
        district: geolocationData.district,
        pincode: geolocationData.pincode,
        state: geolocationData.state,
      });
    }
  } catch (err) {
    console.log("error", err);
    res.status(422).json({ status: "fail", error: err.message });
  }finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.get("/get-state", async (req, res) => {
  const connection = await poolPromise().getConnection();
  try {

    const query = "SELECT * FROM state WHERE status = ? ";
    const queryValues = [1];

    const [results] = await connection.query(query, queryValues);
    if (isEmpty(results)) {
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Data not found",
      });
    }
    connection.release();

    const updatedArray = results.map(
      ({ state_id, state_name, id, ...rest }) => ({ state_id, state_name })
    );

    return res
      .status(200)
      .json({ status: "success", statuscode: "01", data: updatedArray });
  } catch (error) {
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

router.get("/get-district/:stateId", async (req, res) => {
  const connection = await poolPromise().getConnection();
  try {

    const query = "SELECT * FROM district WHERE status = ? AND state_id = ? ";
    const queryValues = [1, req.params.stateId];

    const [results] = await connection.query(query, queryValues);

    connection.release();
    if (isEmpty(results)) {
      return res.status(500).json({
        status: "failed",
        statuscode: "02",
        message: "Data not found",
      });
    }
    const updatedArray = results.map(
      ({ district_name, dist_id, state_name, state_id, ...rest }) => ({
        district_id: dist_id,
        district_name,
        state_name,
        state_id,
      })
    );

    return res
      .status(200)
      .json({ status: "success", statuscode: "01", data: updatedArray });
  } catch (error) {
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

module.exports = router;
