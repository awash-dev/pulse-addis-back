const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

const createCoupon = asyncHandler(async (req, res) => {
  try {
    const newCoupon = await prisma.coupon.create({
      data: {
        name: req.body.name,
        expiry: new Date(req.body.expiry),
        discount: parseInt(req.body.discount)
      }
    });
    await prisma.activity.create({
      data: { action: "create Coupon", userId: req.user?.id, details: { newCoupon } }
    });
    res.json(newCoupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllCoupons = asyncHandler(async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    res.json(coupons);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const data = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.expiry) data.expiry = new Date(req.body.expiry);
    if (req.body.discount !== undefined) data.discount = parseInt(req.body.discount);

    const updatedCoupon = await prisma.coupon.update({ where: { id }, data });
    await prisma.activity.create({
      data: { action: "update Coupon", userId: req.user?.id, details: { updatedCoupon } }
    });
    res.json(updatedCoupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCoupon = await prisma.coupon.delete({ where: { id } });
    await prisma.activity.create({
      data: { action: "Delete Coupon", userId: req.user?.id, details: { deletedCoupon } }
    });
    res.json(deletedCoupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createCoupon, getAllCoupons, updateCoupon, deleteCoupon, getCoupon };