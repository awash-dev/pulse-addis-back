const express = require("express");
const {
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getSubcategory,
    getallSubcategory,
} = require("../controllers/blogSubCategoryController");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/", authMiddleware, isAdmin, createSubcategory);
router.put("/:id", authMiddleware, isAdmin, updateSubcategory);
router.delete("/:id", authMiddleware, isAdmin, deleteSubcategory);
router.get("/:id", getSubcategory);
router.get("/", getallSubcategory);

module.exports = router;