const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const mapStore = (store) => ({
  ...store,
  _id: store.id,
});

const logActivity = async (action, userId, details) => {
  if (!userId) return;

  try {
    await db.query(
      `INSERT INTO "Activity" ("userId", action, details) VALUES ($1, $2, $3)`,
      [userId, action, details],
    );
  } catch (error) {
    console.error("Store activity log error:", error.message);
  }
};

const createStore = asyncHandler(async (req, res) => {
  try {
    const { storeName, address } = req.body;
    const ownerId = req.body.owner_id || req.body.ownerId;

    if (!storeName || !address || !ownerId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { rows } = await db.query(
      `INSERT INTO "Store" ("storeId", "storeName", "ownerId", address)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [req.body.storeId || uuidv4(), storeName, ownerId, address],
    );

    await logActivity("Create store", ownerId, { store: rows[0] });
    res.status(201).json({
      message: "Store created successfully",
      store: mapStore(rows[0]),
    });
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const getStoresByUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const { rows } = await db.query(
      `SELECT
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"
       FROM "Store"
       WHERE "ownerId" = $1
       ORDER BY "storeName" ASC`,
      [id],
    );

    res.status(200).json(rows.map(mapStore));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const updateStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = [];
  const values = [id];

  if (req.body.storeId !== undefined) {
    values.push(req.body.storeId);
    fields.push(`"storeId" = $${values.length}`);
  }
  if (req.body.storeName !== undefined) {
    values.push(req.body.storeName);
    fields.push(`"storeName" = $${values.length}`);
  }
  if (req.body.ownerId !== undefined || req.body.owner_id !== undefined) {
    values.push(req.body.ownerId || req.body.owner_id);
    fields.push(`"ownerId" = $${values.length}`);
  }
  if (req.body.address !== undefined) {
    values.push(req.body.address);
    fields.push(`address = $${values.length}`);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "No store fields provided" });
  }

  values.push(new Date());
  fields.push(`"updatedAt" = $${values.length}`);

  try {
    const { rows } = await db.query(
      `UPDATE "Store"
       SET ${fields.join(", ")}
       WHERE id = $1
       RETURNING
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      values,
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Store not found" });
    }

    await logActivity("Update store", rows[0].ownerId, { store: rows[0] });
    res.json(mapStore(rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const deleteStore = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Store"
       WHERE id = $1
       RETURNING
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Store not found" });
    }

    await logActivity("Delete store", rows[0].ownerId, { store: rows[0] });
    res.status(200).json({
      message: "Store and associated products deleted successfully",
      deletedStore: mapStore(rows[0]),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete store", error: error.message });
  }
});

const getStore = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"
       FROM "Store"
       WHERE "ownerId" = $1
       ORDER BY "storeName" ASC`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json(rows.map(mapStore));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const getallStore = asyncHandler(async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         id,
         "storeId" AS "storeId",
         "storeName" AS "storeName",
         "ownerId" AS "ownerId",
         address,
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"
       FROM "Store"
       ORDER BY "storeName" ASC`,
    );

    res.json(rows.map(mapStore));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = {
  createStore,
  updateStore,
  deleteStore,
  getStore,
  getallStore,
  getStoresByUser,
};
