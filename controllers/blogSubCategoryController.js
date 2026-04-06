const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createSubcategory = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?.id || req.body.userId;
        const newSubcategory = await prisma.blogSubCategory.create({
            data: {
                name: req.body.name,
            }
        });
        
        // Activity log for subcategory creation
        await prisma.activity.create({
            data: {
                action: "create Subcategory",
                userId: userId,
                details: { newSubcategory },
            }
        });
        res.json(newSubcategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const updateSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updatedSubcategory = await prisma.blogSubCategory.update({
            where: { id },
            data: { name: req.body.name }
        });

        // Activity log for subcategory update
        await prisma.activity.create({
            data: {
                action: "update Blog Subcategory",
                userId: req.user?.id,
                details: { updatedSubcategory },
            }
        });
        res.json(updatedSubcategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const deleteSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deletedSubcategory = await prisma.blogSubCategory.delete({
            where: { id }
        });

        // Activity log for subcategory deletion
        await prisma.activity.create({
            data: {
                action: "delete Blog Subcategory",
                userId: req.user?.id,
                details: { deletedSubcategory },
            }
        });
        res.json(deletedSubcategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const subcategory = await prisma.blogSubCategory.findUnique({
            where: { id }
        });
        res.json(subcategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getallSubcategory = asyncHandler(async (req, res) => {
    try {
        const subcategories = await prisma.blogSubCategory.findMany();
        const mapped = subcategories.map(s => ({ ...s, _id: s.id, title: s.name }));
        res.json(mapped);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = {
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getSubcategory,
    getallSubcategory,
};