const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createBrand = asyncHandler(async (req, res) => {
  try {
    const newBrand = await prisma.brand.create({
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "create Brand", userId: req.user?.id, details: { newBrand } }
    });
    res.json({ ...newBrand, _id: newBrand.id, title: newBrand.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "Update Brand", userId: req.user?.id, details: { updatedBrand } }
    });
    res.json({ ...updatedBrand, _id: updatedBrand.id, title: updatedBrand.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedBrand = await prisma.brand.delete({ where: { id } });
    await prisma.activity.create({
      data: { action: "Delete Brand", userId: req.user?.id, details: { deletedBrand } }
    });
    res.json({ ...deletedBrand, _id: deletedBrand.id, title: deletedBrand.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    res.json({ ...brand, _id: brand.id, title: brand.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallBrand = asyncHandler(async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
    const mapped = brands.map(b => ({ ...b, _id: b.id, title: b.name }));
    res.json(mapped);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createBrand, updateBrand, deleteBrand, getBrand, getallBrand };
