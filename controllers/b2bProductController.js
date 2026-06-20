/**
 * B2B Product Controller
 *
 * Handles B2B-specific product queries: filtered catalog, expiring/low-stock alerts.
 * Does NOT replace existing product CRUD — those remain in productController.js.
 */
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");

/**
 * GET /api/b2b/products
 * Public (but prices may be hidden for unverified users — handled on frontend).
 * Filters: b2bCategory, availabilityStatus, search (title/genericName/sku/barcode),
 *          minPrice, maxPrice, countryOfOrigin, regulatoryAuthority
 * Pagination: page, limit
 */
const getB2bProducts = asyncHandler(async (req, res) => {
  const {
    b2bCategory, availabilityStatus, search,
    minPrice, maxPrice, countryOfOrigin, regulatoryAuthority,
    page = 1, limit = 20,
  } = req.query;

  const where = {
    status: "approved",
    b2bCategory: { not: null },   // only products explicitly enabled for B2B
  };

  if (b2bCategory) where.b2bCategory = b2bCategory;
  if (availabilityStatus) where.availabilityStatus = availabilityStatus;
  if (countryOfOrigin) where.countryOfOrigin = countryOfOrigin;
  if (regulatoryAuthority) where.regulatoryAuthority = regulatoryAuthority;

  // Build search conditions using raw SQL for OR across multiple columns
  let searchClause = "";
  const searchParams = [];
  if (search) {
    const term = `%${search}%`;
    searchClause = `AND (
      "title" ILIKE $SEARCH_PARAM
      OR "genericName" ILIKE $SEARCH_PARAM
      OR "sku" ILIKE $SEARCH_PARAM
      OR "barcode" ILIKE $SEARCH_PARAM
    )`;
    searchParams.push(term);
  }

  // Price range on wholesalePrice
  if (minPrice) where.wholesalePrice = { ...where.wholesalePrice, gte: parseFloat(minPrice) };
  if (maxPrice) where.wholesalePrice = { ...where.wholesalePrice, lte: parseFloat(maxPrice) };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // If we have search, use raw SQL; otherwise use the ORM
  if (search) {
    const params = [];
    let paramIdx = 1;

    // Build WHERE clause parts
    const whereParts = [`"status" = 'approved'`, `"b2bCategory" IS NOT NULL`];

    if (b2bCategory) {
      whereParts.push(`"b2bCategory" = $${paramIdx}`);
      params.push(b2bCategory);
      paramIdx++;
    }
    if (availabilityStatus) {
      whereParts.push(`"availabilityStatus" = $${paramIdx}`);
      params.push(availabilityStatus);
      paramIdx++;
    }
    if (countryOfOrigin) {
      whereParts.push(`"countryOfOrigin" = $${paramIdx}`);
      params.push(countryOfOrigin);
      paramIdx++;
    }
    if (regulatoryAuthority) {
      whereParts.push(`"regulatoryAuthority" = $${paramIdx}`);
      params.push(regulatoryAuthority);
      paramIdx++;
    }
    if (minPrice) {
      whereParts.push(`"wholesalePrice" >= $${paramIdx}`);
      params.push(parseFloat(minPrice));
      paramIdx++;
    }
    if (maxPrice) {
      whereParts.push(`"wholesalePrice" <= $${paramIdx}`);
      params.push(parseFloat(maxPrice));
      paramIdx++;
    }

    // Search
    const searchTermParam = paramIdx;
    whereParts.push(`("title" ILIKE $${searchTermParam} OR "genericName" ILIKE $${searchTermParam} OR "sku" ILIKE $${searchTermParam} OR "barcode" ILIKE $${searchTermParam})`);
    params.push(`%${search}%`);
    paramIdx++;

    const whereSQL = whereParts.join(" AND ");

    // Count
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM "Product" WHERE ${whereSQL}`,
      params
    );
    const total = countResult.rows[0].total;

    // Data
    const dataResult = await db.query(
      `SELECT * FROM "Product" WHERE ${whereSQL} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      data: dataResult.rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  }

  // No search — use ORM
  const total = await db.product.count({ where });
  const products = await db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: parseInt(limit),
    skip: offset,
  });

  res.json({
    success: true,
    data: products,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * GET /api/b2b/admin/products
 * Admin only — all B2B-enabled products (any status), for the admin dashboard.
 */
const getAdminB2bProducts = asyncHandler(async (req, res) => {
  const {
    b2bCategory, status, search,
    page = 1, limit = 50,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  let paramIdx = 1;
  const whereParts = [`"b2bCategory" IS NOT NULL`];

  if (b2bCategory) {
    whereParts.push(`"b2bCategory" = $${paramIdx}`);
    params.push(b2bCategory);
    paramIdx++;
  }
  if (status) {
    whereParts.push(`"status" = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }
  if (search) {
    whereParts.push(`("title" ILIKE $${paramIdx} OR "genericName" ILIKE $${paramIdx} OR "sku" ILIKE $${paramIdx} OR "barcode" ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSQL = whereParts.join(" AND ");

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM "Product" WHERE ${whereSQL}`,
    params
  );
  const total = countResult.rows[0].total;

  const dataResult = await db.query(
    `SELECT * FROM "Product" WHERE ${whereSQL} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    success: true,
    data: dataResult.rows,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
});
const getB2bProduct = asyncHandler(async (req, res) => {
  const product = await db.product.findUnique({
    where: { id: req.params.id },
    include: { store: true, reviews: true, colors: true },
  });

  if (!product) {
    return res.status(404).json({ success: false, error: "Product not found." });
  }

  res.json({ success: true, data: product });
});

/**
 * GET /api/b2b/products/expiring-soon
 * Admin only — products expiring within N days (default 90).
 */
const getExpiringSoon = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const result = await db.query(
    `SELECT * FROM "Product"
     WHERE "expiryDate" IS NOT NULL
       AND "expiryDate" <= $1
       AND "expiryDate" > NOW()
     ORDER BY "expiryDate" ASC`,
    [cutoff.toISOString()]
  );

  // Also get already expired
  const expiredResult = await db.query(
    `SELECT * FROM "Product"
     WHERE "expiryDate" IS NOT NULL
       AND "expiryDate" <= NOW()
     ORDER BY "expiryDate" DESC
     LIMIT 50`
  );

  res.json({
    success: true,
    data: {
      expiringSoon: result.rows,
      alreadyExpired: expiredResult.rows,
      counts: {
        expiringSoon: result.rows.length,
        alreadyExpired: expiredResult.rows.length,
      },
    },
  });
});

/**
 * GET /api/b2b/products/low-stock
 * Admin only — products at or below reorderLevel.
 */
const getLowStock = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM "Product"
     WHERE "reorderLevel" > 0
       AND quantity <= "reorderLevel"
     ORDER BY quantity ASC`
  );

  const outOfStock = await db.query(
    `SELECT * FROM "Product"
     WHERE quantity = 0
     ORDER BY "updatedAt" DESC
     LIMIT 50`
  );

  res.json({
    success: true,
    data: {
      lowStock: result.rows,
      outOfStock: outOfStock.rows,
      counts: {
        lowStock: result.rows.length,
        outOfStock: outOfStock.rows.length,
      },
    },
  });
});

module.exports = {
  getB2bProducts,
  getAdminB2bProducts,
  getB2bProduct,
  getExpiringSoon,
  getLowStock,
};
