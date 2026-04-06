const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const createPackage = asyncHandler(async (req, res) => {
  try {
    const newPackage = await db.package.create({
      data: {
        name: req.body.name || req.body.title,
        description: req.body.description || "",
        price: parseFloat(req.body.price) || 0
      }
    });
    await db.activity.create({
      data: { action: "Create Package", userId: req.user?.id, details: { newPackage } }
    });
    res.json(newPackage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updatePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const data = {};
    if (req.body.name || req.body.title) data.name = req.body.name || req.body.title;
    if (req.body.description) data.description = req.body.description;
    if (req.body.price !== undefined) data.price = parseFloat(req.body.price);

    const updatedPackage = await db.package.update({ where: { id }, data });
    await db.activity.create({
      data: { action: "Update Package", userId: req.user?.id, details: { updatedPackage } }
    });
    res.json(updatedPackage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deletePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedPackage = await db.package.delete({ where: { id } });
    await db.activity.create({
      data: { action: "Delete Package", userId: req.user?.id, details: { deletedPackage } }
    });
    res.json(deletedPackage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getPackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const packageData = await db.package.findUnique({ where: { id } });
    res.json(packageData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllPackages = asyncHandler(async (req, res) => {
  try {
    const packages = await db.package.findMany({ orderBy: { createdAt: "desc" } });
    res.json(packages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createPackage, updatePackage, deletePackage, getPackage, getAllPackages };
