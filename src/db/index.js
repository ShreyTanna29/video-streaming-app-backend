import mongoose from "mongoose";
import { DB_Name } from "../constants.js";

async function connectDB() {
  try {
    const connection = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_Name}`
    );
    console.log(`MongoDB connected :: DB HOST: ${connection.connection.host}`);
  } catch (error) {
    console.error("db :: index :: ", error);
    process.exit(1);
  }
}

export default connectDB;
