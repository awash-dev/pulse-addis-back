const prisma = require("../configure/prismaClient");
const asyncHandler = require("express-async-handler");

const createSubcategory = asyncHandler(async (req, res) => {
    try {
        const newSubcategory = await prisma.subcategory.create({
            data: {
                name: req.body.name || req.body.title
            }
        });

        await prisma.activity.create({
            data: {
                action: "create SubCategory",
                userId: req.user?.id || req.body.userId,
                details: JSON.stringify(newSubcategory)
            }
        });
        res.json({ ...newSubcategory, _id: newSubcategory.id, title: newSubcategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const updateSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updatedSubcategory = await prisma.subcategory.update({
            where: { id },
            data: { name: req.body.name || req.body.title }
        });
        
        await prisma.activity.create({
            data: {
                action: "Update SubCategory",
                userId: req.user?.id || req.body.userId,
                details: JSON.stringify(updatedSubcategory)
            }
        });

        res.json({ ...updatedSubcategory, _id: updatedSubcategory.id, title: updatedSubcategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const deleteSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deletedSubcategory = await prisma.subcategory.delete({
            where: { id }
        });

        await prisma.activity.create({
            data: {
                action: "Delete SubCategory",
                userId: req.user?.id || req.body.userId,
                details: JSON.stringify(deletedSubcategory)
            }
        });
        res.json({ ...deletedSubcategory, _id: deletedSubcategory.id, title: deletedSubcategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const subcategory = await prisma.subcategory.findUnique({
            where: { id }
        });
        if (!subcategory) return res.status(404).json({ message: "Subcategory not found" });
        res.json({ ...subcategory, _id: subcategory.id, title: subcategory.name });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const getallSubcategory = asyncHandler(async (req, res) => {
    try {
        const subcategories = await prisma.subcategory.findMany();
        const mapped = subcategories.map(s => ({ ...s, _id: s.id, title: s.name }));
        res.json(mapped);
    } catch (error) {
        throw new Error(error);
    }
});

module.exports = {
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getSubcategory,
    getallSubcategory,
};