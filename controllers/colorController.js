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
    console.error("Color activity log error:", error.message);
  }
};

const mapColor = (color) => ({
  ...color,
  _id: color.id,
  title: color.name,
});

const createColor = asyncHandler(async (req, res) => {
  const name = (req.body.title || req.body.name || "").trim();
  const code = req.body.code || null;

  if (!name) {
    return res.status(400).json({ message: "Color name is required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO "Color" (name, code) VALUES ($1, $2) RETURNING id, name, code`,
      [name, code],
    );

    await logActivity("create Color", req.user?.id, { color: rows[0] });
    res.json(mapColor(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = (req.body.title || req.body.name || "").trim();
  const code = req.body.code ?? null;

  if (!name) {
    return res.status(400).json({ message: "Color name is required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Color"
       SET name = $2, code = $3
       WHERE id = $1
       RETURNING id, name, code`,
      [id, name, code],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Color not found" });
    }

    await logActivity("Update Color", req.user?.id, { color: rows[0] });
    res.json(mapColor(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteColor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Color" WHERE id = $1 RETURNING id, name, code`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Color not found" });
    }

    await logActivity("Delete Color", req.user?.id, { color: rows[0] });
    res.json(mapColor(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getColor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, name, code FROM "Color" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json(mapColor(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getColorsByIds = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

  if (ids.length === 0) {
    return res.json([]);
  }

  try {
    const { rows } = await db.query(
      `SELECT id, name, code
       FROM "Color"
       WHERE id = ANY($1::text[])
       ORDER BY name ASC`,
      [ids],
    );

    res.json(rows.map(mapColor));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallColor = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, code FROM "Color" ORDER BY name ASC`,
    );

    res.json(rows.map(mapColor));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createColor, updateColor, deleteColor, getColor, getallColor, getColorsByIds };
