const db = require("../configure/dbClient");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const USER_SELECT = `
  SELECT
    id,
    firstname,
    lastname,
    username,
    email,
    mobile,
    password,
    role,
    "isActive" AS "isActive",
    "isBlocked" AS "isBlocked",
    "isEmailVerified" AS "isEmailVerified",
    address,
    "profilePictures" AS "profilePictures",
    "emailVerificationOTP" AS "emailVerificationOTP",
    "emailVerificationExpires" AS "emailVerificationExpires",
    "passwordResetOTP" AS "passwordResetOTP",
    "passwordResetExpires" AS "passwordResetExpires",
    "refreshToken" AS "refreshToken",
    "passwordChangedAt" AS "passwordChangedAt",
    "passwordResetToken" AS "passwordResetToken",
    "googleId" AS "googleId",
    "facebookId" AS "facebookId",
    provider,
    "createdAt" AS "createdAt",
    "updatedAt" AS "updatedAt"
  FROM "User"
`;

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ message: "No token provided in header." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.id || decoded?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Not Authorized, token payload is invalid.",
      });
    }

    const { rows } = await db.query(`${USER_SELECT} WHERE id = $1 LIMIT 1`, [userId]);
    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ message: "User session expired. Please login again." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).json({
      message: "Not Authorized, token expired. Please login again.",
    });
  }
});

// Middleware to verify super admin role
const isSuperAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role === "superAdmin") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not a super admin.");
  }
});

// Middleware to verify admin role
const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role === "admin" || req.user.role === "superAdmin") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not an admin.");
  }
});

// Middleware to verify merchant role
const isMerchant = asyncHandler(async (req, res, next) => {
  if (req.user.role === "merchant") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not a merchant.");
  }
});

// Middleware to verify delivery boy role
const isDeliveryBoy = asyncHandler(async (req, res, next) => {
  if (req.user.role === "deliveryBoy") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not a delivery boy.");
  }
});

const isSuperAdminOrAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role === "superAdmin" || req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not an admin or super admin.");
  }
});
const isSuperAdminOrMerchant = asyncHandler(async (req, res, next) => {
  if (req.user.role === "superAdmin" || req.user.role === "merchant") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not an merchant or super admin.");
  }
});
const isAdminSuperAdminOrMerchant = asyncHandler(async (req, res, next) => {
  if (
    req.user.role === "superAdmin" ||
    req.user.role === "merchant" ||
    req.user.role === "admin"
  ) {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied, not an merchant or admin or super admin.");
  }
});

module.exports = {
  authMiddleware,
  isSuperAdmin,
  isAdmin,
  isMerchant,
  isSuperAdminOrMerchant,
  isAdminSuperAdminOrMerchant,
  isDeliveryBoy,
  isSuperAdminOrAdmin,
};
