const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createEnquiry = asyncHandler(async (req, res) => {
  try {
    const newEnquiry = await prisma.fQA.create({
      data: {
        question: req.body.question,
        answer: req.body.answer || ""
      }
    });
    res.json(newEnquiry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateEnquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const data = {};
    if (req.body.question) data.question = req.body.question;
    if (req.body.answer !== undefined) data.answer = req.body.answer;
    const updatedEnquiry = await prisma.fQA.update({ where: { id }, data });
    res.json(updatedEnquiry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteEnquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedEnquiry = await prisma.fQA.delete({ where: { id } });
    res.json(deletedEnquiry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getEnquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const enquiry = await prisma.fQA.findUnique({ where: { id } });
    res.json(enquiry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallEnquiry = asyncHandler(async (req, res) => {
  try {
    const enquiries = await prisma.fQA.findMany();
    res.json(enquiries);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createEnquiry, updateEnquiry, deleteEnquiry, getEnquiry, getallEnquiry };