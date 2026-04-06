const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

// --- AdHome Controllers ---
const createAdHome = asyncHandler(async (req, res) => {
  const ad = await prisma.adHome.create({
    data: req.body
  });
  res.status(201).json(ad);
});

const getAdHome = asyncHandler(async (req, res) => {
  const ads = await prisma.adHome.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(ads);
});

const updateAdHome = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ad = await prisma.adHome.update({
    where: { id },
    data: req.body
  });
  res.json(ad);
});

// --- SpecialAd Controllers ---
const createSpecialAd = asyncHandler(async (req, res) => {
  const ad = await prisma.specialAd.create({
    data: req.body
  });
  res.status(201).json(ad);
});

const getSpecialAds = asyncHandler(async (req, res) => {
  const ads = await prisma.specialAd.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(ads);
});

const updateSpecialAd = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ad = await prisma.specialAd.update({
    where: { id },
    data: req.body
  });
  res.json(ad);
});

// --- BannerAd Controllers ---
const createBannerAd = asyncHandler(async (req, res) => {
  const ad = await prisma.bannerAd.create({
    data: req.body
  });
  res.status(201).json(ad);
});

const getBannerAds = asyncHandler(async (req, res) => {
  const ads = await prisma.bannerAd.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(ads);
});

const updateBannerAd = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ad = await prisma.bannerAd.update({
    where: { id },
    data: req.body
  });
  res.json(ad);
});

// Aggregated ads for one-shot fetch
const getAllAds = asyncHandler(async (req, res) => {
  const [homeAds, specialAds, bannerAds] = await Promise.all([
    prisma.adHome.findMany({ where: { isActive: true } }),
    prisma.specialAd.findMany({ where: { isActive: true } }),
    prisma.bannerAd.findMany({ where: { isActive: true } })
  ]);
  
  res.json({
    homeAds,
    specialAds,
    bannerAds
  });
});

const deleteAd = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  let deleted;
  if (type === 'home') deleted = await prisma.adHome.delete({ where: { id } });
  if (type === 'special') deleted = await prisma.specialAd.delete({ where: { id } });
  if (type === 'banner') deleted = await prisma.bannerAd.delete({ where: { id } });
  
  res.json({ message: "Ad deleted", deleted });
});

module.exports = {
  createAdHome, getAdHome, updateAdHome,
  createSpecialAd, getSpecialAds, updateSpecialAd,
  createBannerAd, getBannerAds, updateBannerAd,
  getAllAds, deleteAd
};
