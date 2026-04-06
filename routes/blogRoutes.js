const express = require("express");
const {
    createBlog,
    updateBlog,
    getBlog,
    getAllBlogs,
    deleteBlog,
    liketheBlog,
    disliketheBlog,
    uploadImages,
} = require("../controllers/blogController");
const { authMiddleware, isAdminSuperAdminOrMerchant } = require("../middlewares/authMiddleware");
//const { blogImgResize, uploadPhoto } = require("../middlewares/uploadImage");
const router = express.Router();

router.post("/", authMiddleware, isAdminSuperAdminOrMerchant, createBlog);
router.put(
    "/upload/:id",
    authMiddleware,
    isAdminSuperAdminOrMerchant,
    //uploadPhoto.array("images", 2),
    //blogImgResize,
    uploadImages
);
router.put("/likes", authMiddleware, liketheBlog);
router.put("/dislikes", authMiddleware, disliketheBlog);

router.put("/:id", authMiddleware, isAdminSuperAdminOrMerchant, updateBlog);

router.get("/:id", getBlog);
router.get("/", getAllBlogs);

router.delete("/:id", authMiddleware, isAdminSuperAdminOrMerchant, deleteBlog);

module.exports = router;