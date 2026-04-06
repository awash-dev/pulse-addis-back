const express = require("express");

const {
  createBrand,
  updateBrand,
  deleteBrand,
  getBrand,
  getallBrand,
} = require("../controllers/brandController");

const {
  authMiddleware,
  isSuperAdminOrAdmin,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Protected routes (admin / super admin only)
router.post("/", authMiddleware, isSuperAdminOrAdmin, createBrand);
router.put("/:id", authMiddleware, isSuperAdminOrAdmin, updateBrand);
router.delete("/:id", authMiddleware, isSuperAdminOrAdmin, deleteBrand);

// Public routes
router.get("/", getallBrand);
router.get("/:id", getBrand);

module.exports = router;
