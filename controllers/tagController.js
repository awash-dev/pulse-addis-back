const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const createTag = asyncHandler(async (req, res) => {
  try {
    const newTag = await db.tag.create({
      data: { name: req.body.name || req.body.title }
    });
    await db.activity.create({
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
    const updatedTag = await db.tag.update({
      where: { id },
      data: { name: req.body.name || req.body.title }
    });
    await db.activity.create({
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
    const deletedTag = await db.tag.delete({ where: { id } });
    await db.activity.create({
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
    const tag = await db.tag.findUnique({ where: { id } });
    res.json(tag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallTag = asyncHandler(async (req, res) => {
  try {
    const tags = await db.tag.findMany({ orderBy: { name: "asc" } });
    res.json(tags);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createTag, updateTag, deleteTag, getTag, getallTag };