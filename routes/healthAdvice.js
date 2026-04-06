const express = require("express");
const {
  createHealthAdvice,
  getHealthAdvice,
  getAHealthAdvice,
  updateHealthAdvice,
  deleteHealthAdvice,
  searchHealthAdvice,
} = require("../controllers/HealthAdviceController");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/recommendations", searchHealthAdvice);
router.post("/", authMiddleware, isAdmin, createHealthAdvice);
router.get("/:id", getAHealthAdvice);
router.put("/:id", authMiddleware, isAdmin, updateHealthAdvice);
router.delete("/:id", authMiddleware, isAdmin, deleteHealthAdvice);
router.get("/", getHealthAdvice);

module.exports = router;
