const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createCategory = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?.id || req.body.userId;
        const newCategory = await prisma.blogCategory.create({
            data: {
                name: req.body.name,
            }
        });
        
        // Activity log for category creation
        await prisma.activity.create({
            data: {
                action: "create Blog Category",
                userId: userId,
                details: { newCategory },
            }
        });

        res.json(newCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updatedCategory = await prisma.blogCategory.update({
            where: { id },
            data: { name: req.body.name }
        });

        // Activity log for category update
        await prisma.activity.create({
            data: {
                action: "update Category",
                userId: req.user?.id,
                details: { updatedCategory },
            }
        });

        res.json(updatedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deletedCategory = await prisma.blogCategory.delete({
            where: { id }
        });

        // Activity log for category deletion
        await prisma.activity.create({
            data: {
                action: "Delete BlogCategory",
                userId: req.user?.id,
                details: { deletedCategory },
            }
        });
        res.json(deletedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const category = await prisma.blogCategory.findUnique({
            where: { id }
        });
        res.json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getallCategory = asyncHandler(async (req, res) => {
    try {
        const categories = await prisma.blogCategory.findMany();
        const mapped = categories.map(c => ({ ...c, _id: c.id, title: c.name }));
        res.json(mapped);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = {
    createCategory,
    updateCategory,
    deleteCategory,
    getCategory,
    getallCategory,
};