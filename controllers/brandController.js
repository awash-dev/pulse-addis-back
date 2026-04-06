const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const logActivity = async (action, userId, details) => {
  if (!userId) return;

  try {
    await db.query(
      `INSERT INTO "Activity" ("userId", action, details) VALUES ($1, $2, $3)`,
      [userId, action, details],
    );
  } catch (error) {
    console.error("Brand activity log error:", error.message);
  }
};

const mapBrand = (brand) => ({
  ...brand,
  _id: brand.id,
  title: brand.name,
});

const createBrand = asyncHandler(async (req, res) => {
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Brand name is required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO "Brand" (name) VALUES ($1) RETURNING id, name`,
      [name],
    );

    await logActivity("create Brand", req.user?.id, { brand: rows[0] });
    res.json(mapBrand(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Brand name is required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Brand" SET name = $2 WHERE id = $1 RETURNING id, name`,
      [id, name],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Brand not found" });
    }

    await logActivity("Update Brand", req.user?.id, { brand: rows[0] });
    res.json(mapBrand(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Brand" WHERE id = $1 RETURNING id, name`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Brand not found" });
    }

    await logActivity("Delete Brand", req.user?.id, { brand: rows[0] });
    res.json(mapBrand(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Brand" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.json(mapBrand(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallBrand = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Brand" ORDER BY name ASC`,
    );

    res.json(rows.map(mapBrand));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createBrand, updateBrand, deleteBrand, getBrand, getallBrand };
