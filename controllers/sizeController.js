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
    console.error("Size activity log error:", error.message);
  }
};

const mapSize = (size) => ({
  ...size,
  _id: size.id,
  title: size.name,
});

const createSize = asyncHandler(async (req, res) => {
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Size name is required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO "Size" (name) VALUES ($1) RETURNING id, name`,
      [name],
    );

    await logActivity("create Size", req.user?.id, { size: rows[0] });
    res.json(mapSize(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Size name is required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Size" SET name = $2 WHERE id = $1 RETURNING id, name`,
      [id, name],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Size not found" });
    }

    await logActivity("Update Size", req.user?.id, { size: rows[0] });
    res.json(mapSize(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteSize = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Size" WHERE id = $1 RETURNING id, name`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Size not found" });
    }

    await logActivity("Delete Size", req.user?.id, { size: rows[0] });
    res.json(mapSize(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getSize = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Size" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Size not found" });
    }

    res.json(mapSize(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallSize = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Size" ORDER BY name ASC`,
    );

    res.json(rows.map(mapSize));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createSize, updateSize, deleteSize, getSize, getallSize };
