const prisma = require("../configure/prismaClient.js");

const createPromotion = async (req, res) => {
  try {
    const newPromotion = await prisma.promotion.create({
      data: {
        title: req.body.title || req.body.name || "Promotion",
        image: req.body.image || "",
        link: req.body.link || null
      }
    });
    await prisma.activity.create({
      data: { action: "create Promotion", userId: req.user?.id, details: { newPromotion } }
    });
    res.status(201).json(newPromotion);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updatePromotion = async (req, res) => {
  const { id } = req.params;
  try {
    const data = {};
    if (req.body.title || req.body.name) data.title = req.body.title || req.body.name;
    if (req.body.image) data.image = req.body.image;
    if (req.body.link !== undefined) data.link = req.body.link;

    const updatedPromotion = await prisma.promotion.update({ where: { id }, data });
    res.json(updatedPromotion);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPromotionById = async (req, res) => {
  const { id } = req.params;
  try {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) return res.status(404).json({ message: "Promotion not found" });
    res.json(promotion);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllPromotions = async (req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(promotions);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deactivatePromotion = async (req, res) => {
  const { id } = req.params;
  try {
    // We don't have active field, so delete it
    const deleted = await prisma.promotion.delete({ where: { id } });
    res.json(deleted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPromotionsByProductId = async (req, res) => {
  // In the new schema, promotions are not linked to products
  res.json([]);
};

module.exports = {
  createPromotion, updatePromotion, getPromotionById,
  getAllPromotions, deactivatePromotion, getPromotionsByProductId
};
