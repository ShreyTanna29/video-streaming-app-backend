import { APIError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // getting details of user
  const { username, fullname, email, password } = req.body;

  // validating details
  if (
    [username, fullname, email, password].some((field) => field?.trim() === "")
  ) {
    throw new APIError(400, "input field cannot be empty.");
  }

  const userExists = await user.findOne({
    $or: [{ email }, { username }],
  });

  if (userExists) {
    throw new APIError(409, "user with this username or email already exists.");
  }

  // getting files/images from multer
  const avatarLocalImage = req.files?.avatar[0]?.path;
  let coverImageLocalPath = "";
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalImage) {
    throw new APIError(400, "avatar is required.");
  }

  // uploading images on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalImage);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new APIError(400, "avatar file uploading error");
  }

  const User = await user.create({
    email,
    username,
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  const createdUser = user.findById(User._id).select("-password -refreshtoken");
  if (!createdUser) {
    throw new APIError(
      500,
      "error :: user.controller :: cannot create user on mongodb :: exeption"
    );
  }

  res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered succesfully"));
});

export default registerUser;
