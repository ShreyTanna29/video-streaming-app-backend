import { APIError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
import { user } from "../models/user.model";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.relpace("Bearer ", "");
    if (!token) {
      throw new APIError(401, "Unauthorized request.");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const User = await user
      .findById(decodedToken?._id)
      .select("-password -refreshToken");

    if (!User) {
      throw new APIError(401, "Inavalid Access Token");
    }

    req.user = User;
    next();
  } catch (error) {
    throw new APIError(401, error?.message || "Inavalid access token");
  }
});
