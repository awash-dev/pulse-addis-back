const express = require("express");
const {
    createSize,
    updateSize,
    deleteSize,
    getSize,
    getallSize,
} = require("../controllers/sizeController");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/", createSize);
router.put("/:id", authMiddleware, isAdmin, updateSize);
router.delete("/:id", authMiddleware, isAdmin, deleteSize);
router.get("/:id", getSize);
router.get("/", getallSize);

module.exports = router;