const express = require("express");
const {
  createProduct,
  getaProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
  addToWishlist,
  rating,
  //new
  getStoreProducts,
  getProductCountByCategory,
  fetchRecentProducts,
  EachMerchantProducts,
  AllGetProductCountByCategory,
  AllfetchRecentProducts,
  NotApprovedProducts,
  RejectedProducts,
  AllMerchantProducts,
  updateProductStatus,
  getAdminProduct,
} = require("../controllers/productController");
const { isAdmin, isSuperAdmin, isSuperAdminOrAdmin, authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// ── Specific named routes MUST come before /:id ──────────────────────────────
router.get("/", getAllProduct); // GET all approved products

// Dashboard & analytics
router.get("/MerchantdashBoard", AllGetProductCountByCategory);
router.get("/MerchantdashBoard/:id", getProductCountByCategory);

// Recent products
router.get("/recent", AllfetchRecentProducts);
router.get("/recent/:id", fetchRecentProducts);

// Merchant/store specific
router.get("/AllProduct", AllMerchantProducts);
router.get("/AllProduct/:id", EachMerchantProducts);
router.get("/store/:id", getStoreProducts);

// Admin approval queues
router.get("/NotApproved", NotApprovedProducts);
router.get("/Rejected", RejectedProducts);

// Admin status updates — SuperAdmin AND Admin can approve/reject
router.patch(
  "/update-status/:id",
  authMiddleware,
  isSuperAdminOrAdmin,
  updateProductStatus,
);

// CRUD
router.post("/", authMiddleware, createProduct);

// Wishlist & rating (put before /:id to avoid conflict)
router.put("/wishlist", authMiddleware, addToWishlist);
router.put("/rating", authMiddleware, rating);

// Param routes last (so specific paths above are not captured)
router.get("/admin/:id", authMiddleware, isSuperAdminOrAdmin, getAdminProduct);
router.get("/:id", getaProduct);
router.put("/:id", updateProduct);
router.delete("/:id", authMiddleware, isAdmin, deleteProduct);

module.exports = router;
