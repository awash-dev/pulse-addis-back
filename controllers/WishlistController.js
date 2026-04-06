const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const WISHLIST_SELECT = `
  SELECT
    p.id,
    p.title,
    p.slug,
    p.description,
    p.price,
    p."oldPrice" AS "oldPrice",
    p.category,
    p.subcategory,
    p.brand,
    p.quantity,
    p.sold,
    p."postedByUserId" AS "postedByUserId",
    p."storeId" AS "storeId",
    p.status,
    p."rejectionReason" AS "rejectionReason",
    p.images,
    p.strength,
    p."requiresPrescription" AS "requiresPrescription",
    p."prescriptionPlans" AS "prescriptionPlans",
    p.tags,
    p.discount,
    p."totalRating" AS "totalRating",
    p."createdAt" AS "createdAt",
    p."updatedAt" AS "updatedAt"
  FROM "_Wishlist" w
  JOIN "Product" p ON p.id = w."A"
`;

const getWishlistProducts = async (userId) => {
  const { rows } = await db.query(
    `${WISHLIST_SELECT}
     WHERE w."B" = $1
     ORDER BY p."createdAt" DESC`,
    [userId],
  );

  return rows.map((product) => ({ ...product, _id: product.id }));
};

const getWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const wishlist = await getWishlistProducts(userId);
    res.json(wishlist);
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "An error occurred while fetching the wishlist." });
  }
});

const addToWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is missing" });
    }

    await db.query(
      `INSERT INTO "_Wishlist" ("A", "B")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [productId, userId],
    );

    const wishlist = await getWishlistProducts(userId);
    res.json(wishlist);
  } catch (error) {
    console.error("Error adding product to wishlist:", error);
    res.status(500).json({ message: "An error occurred while adding the product to the wishlist." });
  }
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is missing" });
    }

    await db.query(
      `DELETE FROM "_Wishlist" WHERE "B" = $1 AND "A" = $2`,
      [userId, productId],
    );

    res.json({ message: "Product removed from wishlist successfully" });
  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ message: "An error occurred while removing the product from the wishlist." });
  }
});

const getWishlistTotal = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM "_Wishlist" WHERE "B" = $1`,
      [userId],
    );

    res.json({ total: rows[0]?.total || 0 });
  } catch (error) {
    console.error("Error fetching total wishlist items:", error);
    res.status(500).json({ message: "An error occurred while fetching the total number of wishlist items." });
  }
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistTotal,
};

