import { APIError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

// generating access and refresh tokens for user
const generateAccessTokenAndRefreshToken = async (userId) => {
  const User = await user.findById(userId);
  const accessToken = User.accessTokenGenerator();
  const refreshToken = User.refreshTokenGenerator();

  User.refreshToken = refreshToken;
  await User.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// options for cookies
const cookieOptions = {
  httpOnly: true,
  secure: true,
};

// user signup
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

export { registerUser };

// user login
const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username && !email) {
    throw new APIError(400, "username or email is required.");
  }
  const userFound = await user.findOne({
    $or: [{ username }, { email }],
  });

  if (!userFound) {
    throw new APIError(404, "User with this email or username doesn't exist");
  }

  const isPasswordValid = await userFound.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new APIError(401, "Invalid user credentials");
  }

  const { refreshToken, accessToken } =
    await generateAccessTokenAndRefreshToken(userFound._id);

  const loggedInUser = await user
    .findById(userFound._id)
    .select("-password -refreshToken");

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, refreshToken, accessToken },
        "User Looged In Succesfully"
      )
    );
});

export { loginUser };

// logout user
const logoutUser = asyncHandler(async (req, res) => {
  user.findByIdAndUpdate(
    // in req we get .user from our auth middleware.
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User Logged out Succesfully"));
});

export { logoutUser };

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingToken) {
    throw new APIError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const User = await user.findById(decodedToken?._id);
    if (!User) {
      throw new APIError(401, "Invalid refresh token");
    }

    if (incomingToken !== User.refreshToken) {
      throw new APIError(401, "refresh token expired or used");
    }

    const { accessToken, newRefreshToken } = generateAccessTokenAndRefreshToken(
      User._id
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "access token refreshed"
        )
      );
  } catch (error) {
    throw new APIError(401, "Inavalid refresh token");
  }
});

export { refreshAccessToken };

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const User = await user.findById(req.user?._id);
  const isPasswordCorrect = await User.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new APIError(400, "Old Password Invalid");
  }

  User.password = newPassword;
  await User.save({ validBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed succesfully"));
});

export { changeCurrentPassword };

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: req.user },
        "Current user fetched succesfully"
      )
    );
});
export { getCurrentUser };

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new APIError(400, "All fields are required");
  }

  const User = user
    .findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullname,
          email,
        },
      },
      { new: true }
    )
    .select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, { User }, "Account details updated successfully")
    );
});

export { updateAccountDetails };

const updateUserAvatar = asyncHandler(async (req, res) => {
  // multer middleware gives req.file and req.files
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new APIError(400, "Avatar file is missing");
  }

  const avatar = uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new APIError(
      400,
      "problem while uploading avatar file to cloudinary"
    );
  }

  const User = user
    .findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      { new: true }
    )
    .select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, User, "Avatar Updated Succesfully."));
});

export { updateUserAvatar };

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // multer middleware gives req.file and req.files
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new APIError(400, "cover image file is missing");
  }

  const coverImage = uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new APIError(
      400,
      "problem while uploading cover image file to cloudinary"
    );
  }

  const User = user
    .findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: coverImage.url,
        },
      },
      { new: true }
    )
    .select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, User, "Cover Image Updated Succesfully."));
});

export { updateUserCoverImage };
