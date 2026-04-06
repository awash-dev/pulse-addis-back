const prisma = require("../configure/prismaClient");
const asyncHandler = require("express-async-handler");

const createCategory = asyncHandler(async (req, res) => {
    try {
        const newCategory = await prisma.category.create({
            data: { name: req.body.name || req.body.title }
        });
        await prisma.activity.create({
            data: {
                action: "Create Category",
                userId: req.user?.id || req.body.userId,
                details: { name: newCategory.name }
            }
        });
        res.json({ ...newCategory, _id: newCategory.id, title: newCategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updatedCategory = await prisma.category.update({
            where: { id },
            data: { name: req.body.name || req.body.title }
        });
        await prisma.activity.create({
            data: {
                action: "Update Category",
                userId: req.user?.id || req.body.userId,
                details: { updatedCategory }
            }
        });
        res.json({ ...updatedCategory, _id: updatedCategory.id, title: updatedCategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deletedCategory = await prisma.category.delete({ where: { id } });
        await prisma.activity.create({
            data: {
                action: "Delete Category",
                userId: req.user?.id || req.body.userId,
                details: { deletedCategory }
            }
        });
        res.json({ ...deletedCategory, _id: deletedCategory.id, title: deletedCategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const category = await prisma.category.findUnique({ where: { id } });
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json({ ...category, _id: category.id, title: category.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getallCategory = asyncHandler(async (req, res) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
        const mapped = categories.map(c => ({ ...c, _id: c.id, title: c.name }));
        res.json(mapped);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = { createCategory, updateCategory, deleteCategory, getCategory, getallCategory };