const prisma = require("../configure/prismaClient");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

// Middleware to handle authentication
const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;
  if (req?.headers?.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];

    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Standardized to { id: "uuid" } or legacy { userId: "uuid" }
        const user = await prisma.user.findUnique({ 
          where: { id: decoded?.id || decoded?.userId } 
        });

        if (!user) {
          return res
            .status(401)
            .json({ message: "User session expired. Please login again." });
        }

        req.user = user;
        next();
      }
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      return res
        .status(401)
        .json({
          message: "Not Authorized, token expired. Please login again.",
        });
    }
  } else {
    return res.status(401).json({ message: "No token provided in header." });
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
