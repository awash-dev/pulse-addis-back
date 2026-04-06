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
    console.error("Subcategory activity log error:", error.message);
  }
};

const mapSubcategory = (subcategory) => ({
  ...subcategory,
  _id: subcategory.id,
  title: subcategory.name,
});

const createSubcategory = asyncHandler(async (req, res) => {
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO "Subcategory" (name) VALUES ($1) RETURNING id, name`,
      [name],
    );

    await logActivity("create SubCategory", req.user?.id || req.body.userId, {
      subcategory: rows[0],
    });

    res.json(mapSubcategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = (req.body.name || req.body.title || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Subcategory" SET name = $2 WHERE id = $1 RETURNING id, name`,
      [id, name],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    await logActivity("Update SubCategory", req.user?.id || req.body.userId, {
      subcategory: rows[0],
    });

    res.json(mapSubcategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Subcategory" WHERE id = $1 RETURNING id, name`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    await logActivity("Delete SubCategory", req.user?.id || req.body.userId, {
      subcategory: rows[0],
    });

    res.json(mapSubcategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getSubcategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Subcategory" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    res.json(mapSubcategory(rows[0]));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getallSubcategory = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM "Subcategory" ORDER BY name ASC`,
    );

    res.json(rows.map(mapSubcategory));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getSubcategory,
  getallSubcategory,
};
