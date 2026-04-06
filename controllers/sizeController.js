const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createSize = asyncHandler(async (req, res) => {
  try {
    const newSize = await prisma.size.create({
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "create Size", userId: req.user?.id, details: { newSize } }
    });
    res.json(newSize);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const updatedSize = await prisma.size.update({
      where: { id },
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "Update Size", userId: req.user?.id, details: { updatedSize } }
    });
    res.json(updatedSize);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedSize = await prisma.size.delete({ where: { id } });
    await prisma.activity.create({
      data: { action: "Delete Size", userId: req.user?.id, details: { deletedSize } }
    });
    res.json(deletedSize);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const size = await prisma.size.findUnique({ where: { id } });
    res.json(size);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallSize = asyncHandler(async (req, res) => {
  try {
    const sizes = await prisma.size.findMany({ orderBy: { name: "asc" } });
    res.json(sizes);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createSize, updateSize, deleteSize, getSize, getallSize };