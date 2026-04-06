const prisma = require("../configure/prismaClient");
const asyncHandler = require("express-async-handler");
const uploadImageOnCloudinary = require("../utils/cloudinary");
const fs = require("fs");

const createBlog = asyncHandler(async (req, res) => {
    try {
        const newBlog = await prisma.blog.create({
            data: {
                title: req.body.title,
                slug: req.body.slug || `${req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`,
                content: req.body.content || req.body.description,
                category: req.body.category,
                subcategory: req.body.subcategory,
                description: req.body.description,
                isPopup: req.body.isPopup || false,
                author: req.body.author || "Admin",
                images: req.body.images
            }
        });
        
        try {
            await prisma.activity.create({
                data: {
                    action: "create Blog",
                    userId: req.user?.id || req.body.userId || "system", // Fallback to system track
                    details: JSON.stringify(newBlog)
                }
            });
        } catch (activityError) {
            console.error("Non-critical activity log failure:", activityError.message);
        }
        res.json(newBlog);
    } catch (error) {
        console.error("Create Blog Error Details:", {
            error: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user ? req.user.id : "No User"
        });
        res.status(400).json({ 
            message: "Database insertion protocol deviation", 
            error: error.message 
        });
    }
});

const updateBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updateData = { ...req.body };
        if (req.body.description && !req.body.content) {
            updateData.content = req.body.description;
        }

        const updatedBlog = await prisma.blog.update({
            where: { id },
            data: updateData
        });

        await prisma.activity.create({
            data: {
                action: "Update Blog",
                userId: req.user?.id || req.body.userId,
                details: JSON.stringify(updatedBlog)
            }
        });
        res.json(updatedBlog);
    } catch (error) {
        throw new Error(error);
    }
});

const getBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const blog = await prisma.blog.findUnique({
            where: { id }
        });
        
        if (blog) {
            await prisma.blog.update({
                where: { id },
                data: { numViews: { increment: 1 } }
            });
        }
        
        res.json({ ...blog, _id: blog.id });
    } catch (error) {
        throw new Error(error);
    }
});

const getAllBlogs = asyncHandler(async (req, res) => {
    try {
        const blogs = await prisma.blog.findMany();
        const mapped = blogs.map(b => ({ ...b, _id: b.id }));
        res.json(mapped);
    } catch (error) {
        throw new Error(error);
    }
});

const deleteBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deletedBlog = await prisma.blog.delete({
            where: { id }
        });

        await prisma.activity.create({
            data: {
                action: "Delete Blog",
                userId: req.user?.id || req.body.userId,
                details: JSON.stringify(deletedBlog)
            }
        });
        res.json(deletedBlog);
    } catch (error) {
        throw new Error(error);
    }
});

const liketheBlog = asyncHandler(async (req, res) => {
    const { blogId } = req.body;
    const loginUserId = req?.user?.id;
    
    try {
        const blog = await prisma.blog.findUnique({ where: { id: blogId } });
        let likes = Array.isArray(blog.likes) ? blog.likes : [];
        
        if (likes.includes(loginUserId)) {
            likes = likes.filter(id => id !== loginUserId);
        } else {
            likes.push(loginUserId);
        }
        
        const updatedBlog = await prisma.blog.update({
            where: { id: blogId },
            data: { likes, isLiked: likes.length > 0 }
        });
        
        res.json(updatedBlog);
    } catch (error) {
        throw new Error(error);
    }
});

const disliketheBlog = asyncHandler(async (req, res) => {
    const { blogId } = req.body;
    const loginUserId = req?.user?.id;
    
    try {
        const blog = await prisma.blog.findUnique({ where: { id: blogId } });
        let dislikes = Array.isArray(blog.dislikes) ? blog.dislikes : [];
        
        if (dislikes.includes(loginUserId)) {
            dislikes = dislikes.filter(id => id !== loginUserId);
        } else {
            dislikes.push(loginUserId);
        }
        
        const updatedBlog = await prisma.blog.update({
            where: { id: blogId },
            data: { dislikes, isDisliked: dislikes.length > 0 }
        });
        
        res.json(updatedBlog);
    } catch (error) {
        throw new Error(error);
    }
});

const uploadImages = asyncHandler(async (req, res) => {
    try {
        const uploader = (path) => uploadImageOnCloudinary(path, "images");
        const urls = [];
        const files = req.files;

        for (const file of files) {
            const { path } = file;
            const newpath = await uploader(path);
            urls.push(newpath);
            try {
                fs.unlinkSync(path);
            } catch (err) {
                console.error(`Failed to delete image ${path}:`, err);
            }
        }

        const images = urls.map((file) => ({
            public_id: file.public_id,
            secure_url: file.secure_url,
        }));

        res.json(images);
    } catch (error) {
        res.status(500).json({ message: "Error uploading images", error });
    }
});

module.exports = {
    createBlog,
    updateBlog,
    getBlog,
    getAllBlogs,
    deleteBlog,
    liketheBlog,
    disliketheBlog,
    uploadImages,
};