const express = require("express");
const {
  createAdHome,
  getAdHome,
  updateAdHome,
  createSpecialAd,
  getSpecialAds,
  updateSpecialAd,
  createBannerAd,
  getBannerAds,
  updateBannerAd,
  getAllAds,
  deleteAd
} = require("../controllers/adController");
const { authMiddleware, isAdmin, isSuperAdminOrAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

// Public routes for client consumption
router.get("/home", getAdHome);
router.get("/special", getSpecialAds);
router.get("/banner", getBannerAds);
router.get("/all", getAllAds);

// Admin-protected routes for ad management
router.post("/home", authMiddleware, isSuperAdminOrAdmin, createAdHome);
router.put("/home/:id", authMiddleware, isSuperAdminOrAdmin, updateAdHome);
router.post("/special", authMiddleware, isSuperAdminOrAdmin, createSpecialAd);
router.put("/special/:id", authMiddleware, isSuperAdminOrAdmin, updateSpecialAd);
router.post("/banner", authMiddleware, isSuperAdminOrAdmin, createBannerAd);
router.put("/banner/:id", authMiddleware, isSuperAdminOrAdmin, updateBannerAd);
router.delete("/:type/:id", authMiddleware, isSuperAdminOrAdmin, deleteAd);


module.exports = router;
