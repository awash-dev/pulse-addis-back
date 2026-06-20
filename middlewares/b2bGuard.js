/**
 * B2B Guard Middleware
 *
 * Protects routes that require the user to be a verified B2B customer.
 * Must be used AFTER authMiddleware (so req.user is populated).
 */
const asyncHandler = require("express-async-handler");

/**
 * Allows only verified B2B customers (users with isVerified === true).
 * Unverified users receive a 403 with a descriptive message.
 */
const isVerifiedB2bCustomer = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
  }

  // Bypass verification check if user is verified OR the order uses PREPAID (direct online payment)
  if (req.user.isVerified === true || req.body.paymentMethod === "PREPAID") {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Your B2B account is pending verification. You can browse the catalog and place orders via direct online payment (Chapa), but credit terms are disabled until verified.",
    verificationStatus: "PENDING",
  });
});

/**
 * Allows admin/superAdmin OR verified B2B customers.
 * Useful for endpoints shared between admin views and customer self-service.
 */
const isAdminOrVerifiedCustomer = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }

  const role = req.user.role;
  if (role === "superAdmin" || role === "admin") {
    return next();
  }

  if (req.user.isVerified === true) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Access denied. Admin privileges or verified B2B account required.",
  });
});

module.exports = { isVerifiedB2bCustomer, isAdminOrVerifiedCustomer };
