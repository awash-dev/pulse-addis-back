const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createTag = asyncHandler(async (req, res) => {
  try {
    const newTag = await prisma.tag.create({
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "Create Tag", userId: req.user?.id, details: { newTag } }
    });
    res.json(newTag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTag = await prisma.tag.update({
      where: { id },
      data: { name: req.body.name || req.body.title }
    });
    await prisma.activity.create({
      data: { action: "Update Tag", userId: req.user?.id, details: { updatedTag } }
    });
    res.json(updatedTag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedTag = await prisma.tag.delete({ where: { id } });
    await prisma.activity.create({
      data: { action: "Delete Tag", userId: req.user?.id, details: { deletedTag } }
    });
    res.json(deletedTag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });
    res.json(tag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallTag = asyncHandler(async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    res.json(tags);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createTag, updateTag, deleteTag, getTag, getallTag };