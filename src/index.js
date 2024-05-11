import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
  path: "./.env",
});

const DBconnection = connectDB();
DBconnection.then(() => {
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log("app listening on ", port);
  });
}).catch((err) => {
  console.log("src/index :: DBconnection Error", err);
});
