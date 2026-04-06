const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const { conditionName, healthAdvice, keySymptoms, author, image } = req.body;
    const newAdvice = await prisma.healthAdvice.create({
      data: {
        conditionName: conditionName || "Untitled Guide",
        healthAdvice: healthAdvice || "",
        keySymptoms: keySymptoms || [],
        author: author || "Pulse Admin",
        image: image || null
      }
    });
    res.status(201).json(newAdvice);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const getHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const allAdvice = await prisma.healthAdvice.findMany({
      orderBy: { createdAt: "desc" }
    });
    // Add _id for frontend compatibility
    const mapped = allAdvice.map(a => ({ ...a, _id: a.id }));
    res.status(200).json(mapped);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const getAHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const advice = await prisma.healthAdvice.findUnique({ where: { id } });
    if (!advice) {
      return res.status(404).json({ status: "error", message: "Health Advice not found" });
    }
    res.status(200).json({ ...advice, _id: advice.id });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const updateHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { conditionName, healthAdvice, keySymptoms, author, image } = req.body;
    
    const advice = await prisma.healthAdvice.update({
      where: { id },
      data: {
        conditionName,
        healthAdvice,
        keySymptoms,
        author,
        image
      }
    });
    res.status(200).json(advice);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const deleteHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.healthAdvice.delete({ where: { id } });
    res.status(200).json({ message: "Health Advice deleted" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const searchHealthAdvice = asyncHandler(async (req, res) => {
  try {
    const query = req.query.query || "";
    if (!query) return res.status(200).json([]);
    const advices = await prisma.healthAdvice.findMany({
      where: {
        OR: [
          { conditionName: { contains: query, mode: "insensitive" } },
          { healthAdvice: { contains: query, mode: "insensitive" } }
        ]
      }
    });
    res.status(200).json(advices);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = {
  createHealthAdvice, getHealthAdvice, getAHealthAdvice,
  updateHealthAdvice, deleteHealthAdvice, searchHealthAdvice
};
