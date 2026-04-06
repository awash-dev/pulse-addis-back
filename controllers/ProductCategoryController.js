const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");

const logActivity = async (action, userId, details) => {
  if (!userId) return;

  try {
    await db.query(
      `INSERT INTO "Activity" ("userId", action, details) VALUES ($1, $2, $3)`,
      [userId, action, details],
    );
  } catch (error) {
    console.error("Category activity log error:", error.message);
  }
};

const mapCategory = (category) => ({
  ...category,
  _id: category.id,
  title: category.name,
});

const createCategory = asyncHandler(async (req, res) => {
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO "Category" (name) VALUES ($1) RETURNING id, name`,
      [name],
    );

    await logActivity("Create Category", req.user?.id || req.body.userId, {
      category: rows[0],
    });

    res.json(mapCategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Category" SET name = $2 WHERE id = $1 RETURNING id, name`,
      [id, name],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Category not found" });
    }

    await logActivity("Update Category", req.user?.id || req.body.userId, {
      category: rows[0],
    });

    res.json(mapCategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Category" WHERE id = $1 RETURNING id, name`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Category not found" });
    }

    await logActivity("Delete Category", req.user?.id || req.body.userId, {
      category: rows[0],
    });

    res.json(mapCategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Category" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(mapCategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallCategory = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Category" ORDER BY name ASC`,
    );

    res.json(rows.map(mapCategory));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = { createCategory, updateCategory, deleteCategory, getCategory, getallCategory };
