const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createColor = asyncHandler(async (req, res) => {
  try {
    const newColor = await prisma.color.create({
      data: {
        name: req.body.title || req.body.name,
        code: req.body.code || null
      }
    });
    await prisma.activity.create({
      data: { action: "create Color", userId: req.user?.id, details: { newColor } }
    });
    res.json(newColor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const updatedColor = await prisma.color.update({
      where: { id },
      data: {
        name: req.body.title || req.body.name,
        code: req.body.code
      }
    });
    await prisma.activity.create({
      data: { action: "Update Color", userId: req.user?.id, details: { updatedColor } }
    });
    res.json(updatedColor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedColor = await prisma.color.delete({ where: { id } });
    await prisma.activity.create({
      data: { action: "Delete Color", userId: req.user?.id, details: { deletedColor } }
    });
    res.json(deletedColor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const color = await prisma.color.findUnique({ where: { id } });
    res.json(color);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getColorsByIds = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  try {
    const colors = await prisma.color.findMany({
      where: { id: { in: ids } }
    });
    res.json(colors);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallColor = asyncHandler(async (req, res) => {
  try {
    const colors = await prisma.color.findMany({ orderBy: { name: "asc" } });
    res.json(colors);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createColor, updateColor, deleteColor, getColor, getallColor, getColorsByIds };