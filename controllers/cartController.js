const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const CART_SELECT = `
  SELECT
    c.id,
    c."userId" AS "userId",
    c."productId" AS "productId",
    c.quantity,
    c."selectedColor" AS "selectedColor",
    c."selectedSize" AS "selectedSize",
    c."createdAt" AS "createdAt",
    c."updatedAt" AS "updatedAt",
    json_build_object(
      'id', p.id,
      '_id', p.id,
      'title', p.title,
      'slug', p.slug,
      'description', p.description,
      'price', p.price,
      'oldPrice', p."oldPrice",
      'category', p.category,
      'subcategory', p.subcategory,
      'brand', p.brand,
      'quantity', p.quantity,
      'sold', p.sold,
      'storeId', p."storeId",
      'status', p.status,
      'rejectionReason', p."rejectionReason",
      'images', p.images,
      'strength', p.strength,
      'requiresPrescription', p."requiresPrescription",
      'prescriptionPlans', p."prescriptionPlans",
      'tags', p.tags,
      'discount', p.discount,
      'totalRating', p."totalRating",
      'createdAt', p."createdAt",
      'updatedAt', p."updatedAt"
    ) AS product
  FROM "Cart" c
  JOIN "Product" p ON p.id = c."productId"
`;

const getCartRows = async (userId) => {
  const { rows } = await db.query(
    `${CART_SELECT} WHERE c."userId" = $1 ORDER BY c."createdAt" DESC`,
    [userId],
  );

  return rows.map((item) => ({
    ...item,
    productId: item.product,
  }));
};

const findCartItem = async (userId, productId, selectedColor, selectedSize) => {
  const { rows } = await db.query(
    `SELECT
       id,
       "userId" AS "userId",
       "productId" AS "productId",
       quantity,
       "selectedColor" AS "selectedColor",
       "selectedSize" AS "selectedSize"
     FROM "Cart"
     WHERE "userId" = $1
       AND "productId" = $2
       AND "selectedColor" = $3
       AND "selectedSize" = $4
     LIMIT 1`,
    [userId, productId, selectedColor, selectedSize],
  );

  return rows[0];
};

const getCart = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is missing" });
    }

    const cartItems = await getCartRows(userId);
    res.status(200).json({ cart_items: cartItems });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ message: "An error occurred" });
  }
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const selectedColor = req.body.selectedColor || "default";
  const selectedSize = req.body.selectedSize || "standard";
  const userId = req.user.id;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const existingItem = await findCartItem(
      userId,
      productId,
      selectedColor,
      selectedSize,
    );

    if (existingItem) {
      const { rows } = await db.query(
        `UPDATE "Cart"
         SET quantity = quantity + 1, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING
           id,
           "userId" AS "userId",
           "productId" AS "productId",
           quantity,
           "selectedColor" AS "selectedColor",
           "selectedSize" AS "selectedSize",
           "createdAt" AS "createdAt",
           "updatedAt" AS "updatedAt"`,
        [existingItem.id],
      );

      return res.status(200).json(rows[0]);
    }

    const { rows } = await db.query(
      `INSERT INTO "Cart" ("userId", "productId", quantity, "selectedColor", "selectedSize")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         "userId" AS "userId",
         "productId" AS "productId",
         quantity,
         "selectedColor" AS "selectedColor",
         "selectedSize" AS "selectedSize",
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [userId, productId, 1, selectedColor, selectedSize],
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ message: "Error adding product to cart" });
  }
});

const increaseCartQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const { rows: cartRows } = await db.query(
      `SELECT id FROM "Cart" WHERE "userId" = $1 AND "productId" = $2 ORDER BY "createdAt" ASC LIMIT 1`,
      [userId, productId],
    );

    if (!cartRows[0]) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    const { rows } = await db.query(
      `UPDATE "Cart"
       SET quantity = quantity + 1, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING
         id,
         "userId" AS "userId",
         "productId" AS "productId",
         quantity,
         "selectedColor" AS "selectedColor",
         "selectedSize" AS "selectedSize",
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [cartRows[0].id],
    );

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error increasing quantity" });
  }
});

const decreaseCartQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const { rows: cartRows } = await db.query(
      `SELECT id, quantity
       FROM "Cart"
       WHERE "userId" = $1 AND "productId" = $2
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      [userId, productId],
    );

    const cartItem = cartRows[0];

    if (!cartItem) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    if (cartItem.quantity > 1) {
      const { rows } = await db.query(
        `UPDATE "Cart"
         SET quantity = quantity - 1, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING
           id,
           "userId" AS "userId",
           "productId" AS "productId",
           quantity,
           "selectedColor" AS "selectedColor",
           "selectedSize" AS "selectedSize",
           "createdAt" AS "createdAt",
           "updatedAt" AS "updatedAt"`,
        [cartItem.id],
      );

      return res.status(200).json(rows[0]);
    }

    await db.query(`DELETE FROM "Cart" WHERE id = $1`, [cartItem.id]);
    return res.status(200).json({ message: "Product removed from cart" });
  } catch (error) {
    res.status(500).json({ message: "Error decreasing quantity" });
  }
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Cart"
       WHERE id = (
         SELECT id
         FROM "Cart"
         WHERE "userId" = $1 AND "productId" = $2
         ORDER BY "createdAt" ASC
         LIMIT 1
       )
       RETURNING id`,
      [userId, productId],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    res.status(200).json({ message: "Product removed from cart" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing product from cart", error });
  }
});

const getCartTotal = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is missing" });
  }

  try {
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS total_quantity
       FROM "Cart"
       WHERE "userId" = $1`,
      [userId],
    );

    res.status(200).json({
      total_quantity: rows[0]?.total_quantity || 0,
    });
  } catch (error) {
    console.error("Error fetching cart total:", error);
    res.status(500).json({ message: "Error fetching cart total" });
  }
});

const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is missing" });
  }

  try {
    await db.query(`DELETE FROM "Cart" WHERE "userId" = $1`, [userId]);
    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Error clearing cart" });
  }
});

module.exports = {
  clearCart,
  getCart,
  addToCart,
  getCartTotal,
  increaseCartQuantity,
  decreaseCartQuantity,
  removeFromCart,
};

