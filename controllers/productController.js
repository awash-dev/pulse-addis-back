const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");

const PRODUCT_SELECT = `
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
  FROM "Product" p
`;

const STORE_SELECT = `
  SELECT
    id,
    "storeId" AS "storeId",
    "storeName" AS "storeName",
    "ownerId" AS "ownerId",
    address,
    "createdAt" AS "createdAt",
    "updatedAt" AS "updatedAt"
  FROM "Store"
`;

const runQuery = (client, text, params = []) => client.query(text, params);

const logActivity = async (client, action, userId, details) => {
  if (!userId) return;

  try {
    await runQuery(
      client || db,
      `INSERT INTO "Activity" ("userId", action, details) VALUES ($1, $2, $3)`,
      [userId, action, details],
    );
  } catch (error) {
    console.error("Product activity log error:", error.message);
  }
};

const normalizeProduct = (product, related = {}) => ({
  ...product,
  _id: product.id,
  store: related.store || null,
  colors: related.colors || [],
  ...(related.reviews ? { reviews: related.reviews } : {}),
});

const hydrateProducts = async (products, { includeReviews = false } = {}) => {
  if (products.length === 0) {
    return [];
  }

  const storeIds = [...new Set(products.map((product) => product.storeId).filter(Boolean))];
  const productIds = products.map((product) => product.id);

  const storeMap = new Map();
  const colorsMap = new Map();
  const reviewsMap = new Map();

  if (storeIds.length > 0) {
    const { rows } = await db.query(
      `${STORE_SELECT} WHERE id = ANY($1::text[])`,
      [storeIds],
    );

    for (const store of rows) {
      storeMap.set(store.id, { ...store, _id: store.id });
    }
  }

  if (productIds.length > 0) {
    const { rows } = await db.query(
      `SELECT
         pc.id,
         pc."productId" AS "productId",
         pc."colorId" AS "colorId",
         pc.images,
         c.id AS "colorEntityId",
         c.name AS "colorName",
         c.code AS "colorCode"
       FROM "ProductColor" pc
       JOIN "Color" c ON c.id = pc."colorId"
       WHERE pc."productId" = ANY($1::text[])
       ORDER BY c.name ASC, pc.id ASC`,
      [productIds],
    );

    for (const row of rows) {
      const current = colorsMap.get(row.productId) || [];
      current.push({
        id: row.id,
        _id: row.id,
        productId: row.productId,
        colorId: row.colorId,
        images: row.images,
        color: {
          id: row.colorEntityId,
          _id: row.colorEntityId,
          name: row.colorName,
          title: row.colorName,
          code: row.colorCode,
        },
      });
      colorsMap.set(row.productId, current);
    }
  }

  if (includeReviews && productIds.length > 0) {
    const { rows } = await db.query(
      `SELECT
         r.id,
         r.rating,
         r.comment,
         r."productId" AS "productId",
         r."userId" AS "userId",
         r."createdAt" AS "createdAt",
         u.id AS "reviewUserId",
         u.firstname,
         u.lastname,
         u.email,
         u.mobile,
         u.role,
         u."profilePictures" AS "profilePictures"
       FROM "Review" r
       JOIN "User" u ON u.id = r."userId"
       WHERE r."productId" = ANY($1::text[])
       ORDER BY r."createdAt" DESC`,
      [productIds],
    );

    for (const row of rows) {
      const current = reviewsMap.get(row.productId) || [];
      current.push({
        id: row.id,
        _id: row.id,
        rating: row.rating,
        comment: row.comment,
        productId: row.productId,
        userId: row.userId,
        createdAt: row.createdAt,
        user: {
          id: row.reviewUserId,
          _id: row.reviewUserId,
          firstname: row.firstname,
          lastname: row.lastname,
          email: row.email,
          mobile: row.mobile,
          role: row.role,
          profilePictures: row.profilePictures,
        },
      });
      reviewsMap.set(row.productId, current);
    }
  }

  return products.map((product) =>
    normalizeProduct(product, {
      store: storeMap.get(product.storeId) || null,
      colors: colorsMap.get(product.id) || [],
      reviews: includeReviews ? reviewsMap.get(product.id) || [] : undefined,
    }),
  );
};

const fetchProducts = async (queryText, params = [], options = {}) => {
  const { rows } = await db.query(queryText, params);
  return hydrateProducts(rows, options);
};

const extractProductImages = (colorImagePairs) => {
  if (!Array.isArray(colorImagePairs)) {
    return [];
  }

  const firstPairWithImages = colorImagePairs.find(
    (pair) => Array.isArray(pair.images) && pair.images.length > 0,
  );

  return firstPairWithImages ? firstPairWithImages.images : [];
};

const filterValidColorPairs = (colorImagePairs) =>
  Array.isArray(colorImagePairs)
    ? colorImagePairs.filter(
        (pair) => pair.color && Array.isArray(pair.images) && pair.images.length > 0,
      )
    : [];

const insertProductColors = async (client, productId, colorImagePairs) => {
  const validPairs = filterValidColorPairs(colorImagePairs);

  for (const pair of validPairs) {
    await client.query(
      `INSERT INTO "ProductColor" ("productId", "colorId", images)
       VALUES ($1, $2, $3)`,
      [productId, pair.color, pair.images],
    );
  }
};

const getProductById = async (id, { approvedOnly = false, includeReviews = false } = {}) => {
  const conditions = [`p.id = $1`];

  if (approvedOnly) {
    conditions.push(`p.status = 'approved'`);
  }

  const products = await fetchProducts(
    `${PRODUCT_SELECT} WHERE ${conditions.join(" AND ")} LIMIT 1`,
    [id],
    { includeReviews },
  );

  return products[0] || null;
};

const createProductLegacy = asyncHandler(async (req, res) => {
  try {
    const { 
      title, description, price, oldPrice, category, subcategory, 
      brand, quantity, store, strength, requiresPrescription, tags, 
      PostedByuserId, colorImagePairs, prescriptionPlans 
    } = req.body;
    
    let slug = req.body.slug;
    if (title && !slug) {
      slug = slugify(title).toLowerCase() + '-' + Math.random().toString(36).substring(2, 6);
    }
    
    // req.user is guaranteed by authMiddleware — use its UUID directly
    const postedByUserId = req.user?.id;
    if (!postedByUserId) {
      return res.status(401).json({ message: "Authentication required to create a product." });
    }

    // Identify any images provided in any variant to use as product thumbnail
    const firstPairWithImages = Array.isArray(colorImagePairs) ? colorImagePairs.find(p => p.images && p.images.length > 0) : null;
    const productImages = firstPairWithImages ? firstPairWithImages.images : [];

    const newProduct = await db.product.create({
      data: {
        title,
        slug,
        description: description || "",
        price: parseFloat(price) || 0,
        oldPrice: oldPrice ? parseFloat(oldPrice) : 100.0,
        category: category || "",
        subcategory: subcategory || "",
        brand: brand || "",
        quantity: parseInt(quantity) || 0,
        postedBy: { connect: { id: postedByUserId } },
        store: { connect: { id: store } },
        status: 'pending', // Always start as pending
        strength: strength || "",
        requiresPrescription: requiresPrescription === 'true' || requiresPrescription === true,
        tags: Array.isArray(tags) ? tags : [],
        prescriptionPlans: prescriptionPlans || [],
        images: productImages,
        colors: {
          create: (Array.isArray(colorImagePairs) ? colorImagePairs : [])
            .filter(p => p.color && p.images && p.images.length > 0)
            .map(p => ({
              color: { connect: { id: p.color } },
              images: p.images
            }))
        }
      },
      include: { colors: { include: { color: true } } }
    });

    await db.activity.create({
      data: {
        action: "create Product",
        userId: postedByUserId,
        details: JSON.stringify(newProduct)
      }
    });

    res.json({...newProduct, _id: newProduct.id});
  } catch (error) {
    console.error("Create Product Error:", error);
    res.status(400).json({ message: error.message });
  }
});

const getaProductLegacy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const product = await db.product.findUnique({
      where: { id },
      include: { 
        store: true, 
        reviews: { include: { user: true } },
        colors: { include: { color: true } }
      }
    });
    if (!product || product.status !== 'approved') {
      return res.status(404).json({ message: "Product not found or pending approval" });
    }
    res.json({ ...product, _id: product.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin version — returns any product regardless of approval status
const getAdminProductLegacy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const product = await db.product.findUnique({
      where: { id },
      include: { 
        store: true, 
        reviews: { include: { user: true } },
        colors: { include: { color: true } }
      }
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ ...product, _id: product.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const getAllProductLegacy = asyncHandler(async (req, res) => {
  try {
    const products = await db.product.findMany({
      where: { status: 'approved' },
      include: { 
        store: true, 
        colors: { include: { color: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const mapped = products.map(p => ({ ...p, _id: p.id }));
    res.json(mapped);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateProductLegacy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const { 
        title, description, price, oldPrice, category, subcategory, 
        brand, quantity, store, strength, requiresPrescription, tags,
        colorImagePairs, prescriptionPlans 
    } = req.body;
    
    const updateData = {};
    if (title && title.trim()) {
        updateData.title = title;
        updateData.slug = slugify(title).toLowerCase() + '-' + id.slice(-4);
    }
    if (description !== undefined) updateData.description = description;

    if (price !== undefined && price !== "") {
        const p = parseFloat(price);
        if (!isNaN(p)) updateData.price = p;
    }
    if (oldPrice !== undefined && oldPrice !== "") {
        const op = parseFloat(oldPrice);
        if (!isNaN(op)) updateData.oldPrice = op;
    }
    if (quantity !== undefined && quantity !== "") {
        const q = parseInt(quantity);
        if (!isNaN(q)) updateData.quantity = q;
    }

    if (category) updateData.category = category;
    if (subcategory) updateData.subcategory = subcategory;
    if (brand) updateData.brand = brand;
    if (store) updateData.storeId = store;
    if (strength !== undefined) updateData.strength = strength;
    
    if (requiresPrescription !== undefined) {
        updateData.requiresPrescription = (requiresPrescription === 'true' || requiresPrescription === true);
    }
    
    if (tags) updateData.tags = Array.isArray(tags) ? tags : [];
    if (prescriptionPlans) updateData.prescriptionPlans = prescriptionPlans;

    // Logic: Non-superAdmins revert products to 'pending' on update for re-review
    if (req.user?.role !== 'superAdmin') {
      updateData.status = 'pending';
    }

    // Handle color variants update
    if (Array.isArray(colorImagePairs)) {
        // Update product images thumbnail from first variant that actually has images
        const firstPairWithImages = colorImagePairs.find(p => p.images && p.images.length > 0);
        if (firstPairWithImages) {
            updateData.images = firstPairWithImages.images;
        }

        const validPairs = colorImagePairs.filter(p => p.color && p.images && p.images.length > 0);

        // Simplest way to sync variants is delete existing and recreate
        await db.productColor.deleteMany({ where: { productId: id } });
        
        updateData.colors = {
            create: validPairs.map(p => ({
                color: { connect: { id: p.color } },
                images: p.images
            }))
        };
    }

    console.log("Updating Product with data:", JSON.stringify(updateData));

    const updatedProduct = await db.product.update({
      where: { id },
      data: updateData,
      include: { colors: { include: { color: true } } }
    });
    res.json(updatedProduct);
  } catch (error) {
    console.error("Update Product Error:", error.message, error.stack);
    res.status(400).json({ 
        message: "Product update protocol deviation", 
        error: error.message 
    });
  }
});

const deleteProductLegacy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedProduct = await db.product.delete({
      where: { id }
    });
    res.json(deletedProduct);
  } catch (error) {
    throw new Error(error);
  }
});

const updateProductStatusLegacy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ProductApproved, rejectionReason } = req.body;
  try {
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        status: ProductApproved.toLowerCase(),
        rejectionReason: rejectionReason
      }
    });
    res.json(updatedProduct);
  } catch (error) {
    throw new Error(error);
  }
});

// Added back missing functions for routes
const getStoreProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({ 
    where: { 
      storeId: req.params.id,
      status: 'approved'
    },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json(mapped);
});

const getProductCountByCategoryLegacy = asyncHandler(async (req, res) => {
  const counts = await db.product.groupBy({
    by: ['category'],
    where: { postedByUserId: req.params.id },
    _count: { id: true }
  });
  res.json({ success: true, data: counts.map(c => ({ category: c.category, count: c._count.id })) });
});

const AllGetProductCountByCategoryLegacy = asyncHandler(async (req, res) => {
  const counts = await db.product.groupBy({
    by: ['category'],
    _count: { id: true }
  });
  res.json({ success: true, data: counts.map(c => ({ category: c.category, count: c._count.id })) });
});

const fetchRecentProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({
    where: { postedByUserId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { store: true }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const AllfetchRecentProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({
    where: { status: 'approved' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const EachMerchantProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({ 
    where: { postedByUserId: req.params.id },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const AllMerchantProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({ 
    include: { store: true, colors: { include: { color: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const NotApprovedProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({ 
    where: { status: 'pending' },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ products: mapped, pagination: { currentPage: 1, totalPages: 1, totalCount: products.length } });
});

const RejectedProductsLegacy = asyncHandler(async (req, res) => {
  const products = await db.product.findMany({ where: { status: 'rejected' } });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ products: mapped, pagination: { currentPage: 1, totalPages: 1, totalCount: products.length } });
});

const addToWishlistLegacy = asyncHandler(async (req, res) => {
  res.status(501).json({ message: "Wishlist migration in progress" });
});

const ratingLegacy = asyncHandler(async (req, res) => {
  res.status(501).json({ message: "Rating migration in progress" });
});

const createProduct = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    price,
    oldPrice,
    category,
    subcategory,
    brand,
    quantity,
    store,
    strength,
    requiresPrescription,
    tags,
    colorImagePairs,
    prescriptionPlans,
  } = req.body;

  let slug = req.body.slug;
  if (title && !slug) {
    slug = `${slugify(title).toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const postedByUserId = req.user?.id;
  if (!postedByUserId) {
    return res.status(401).json({ message: "Authentication required to create a product." });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO "Product" (
         title,
         slug,
         description,
         price,
         "oldPrice",
         category,
         subcategory,
         brand,
         quantity,
         "postedByUserId",
         "storeId",
         status,
         strength,
         "requiresPrescription",
         tags,
         "prescriptionPlans",
         images
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16, $17
       )
       RETURNING id`,
      [
        title,
        slug,
        description || "",
        Number.parseFloat(price) || 0,
        oldPrice !== undefined && oldPrice !== "" ? Number.parseFloat(oldPrice) : 100.0,
        category || "",
        subcategory || "",
        brand || "",
        Number.parseInt(quantity, 10) || 0,
        postedByUserId,
        store,
        "pending",
        strength || "",
        requiresPrescription === "true" || requiresPrescription === true,
        Array.isArray(tags) ? tags : [],
        prescriptionPlans || [],
        extractProductImages(colorImagePairs),
      ],
    );

    const productId = rows[0].id;
    await insertProductColors(client, productId, colorImagePairs);
    await logActivity(client, "create Product", postedByUserId, { productId, title });
    await client.query("COMMIT");

    const newProduct = await getProductById(productId);
    res.json(newProduct);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Product Error:", error);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const product = await getProductById(id, { approvedOnly: true, includeReviews: true });

    if (!product) {
      return res.status(404).json({ message: "Product not found or pending approval" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const getAdminProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const product = await getProductById(id, { includeReviews: true });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    const products = await fetchProducts(
      `${PRODUCT_SELECT}
       WHERE p.status = 'approved'
       ORDER BY p."createdAt" DESC`,
    );

    res.json(products);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    price,
    oldPrice,
    category,
    subcategory,
    brand,
    quantity,
    store,
    strength,
    requiresPrescription,
    tags,
    colorImagePairs,
    prescriptionPlans,
  } = req.body;

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `SELECT id FROM "Product" WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!existingRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    const values = [id];
    const updates = [];

    if (title && title.trim()) {
      values.push(title);
      updates.push(`title = $${values.length}`);
      values.push(`${slugify(title).toLowerCase()}-${id.slice(-4)}`);
      updates.push(`slug = $${values.length}`);
    }
    if (description !== undefined) {
      values.push(description);
      updates.push(`description = $${values.length}`);
    }
    if (price !== undefined && price !== "") {
      const parsedPrice = Number.parseFloat(price);
      if (!Number.isNaN(parsedPrice)) {
        values.push(parsedPrice);
        updates.push(`price = $${values.length}`);
      }
    }
    if (oldPrice !== undefined && oldPrice !== "") {
      const parsedOldPrice = Number.parseFloat(oldPrice);
      if (!Number.isNaN(parsedOldPrice)) {
        values.push(parsedOldPrice);
        updates.push(`"oldPrice" = $${values.length}`);
      }
    }
    if (quantity !== undefined && quantity !== "") {
      const parsedQuantity = Number.parseInt(quantity, 10);
      if (!Number.isNaN(parsedQuantity)) {
        values.push(parsedQuantity);
        updates.push(`quantity = $${values.length}`);
      }
    }
    if (category) {
      values.push(category);
      updates.push(`category = $${values.length}`);
    }
    if (subcategory) {
      values.push(subcategory);
      updates.push(`subcategory = $${values.length}`);
    }
    if (brand) {
      values.push(brand);
      updates.push(`brand = $${values.length}`);
    }
    if (store) {
      values.push(store);
      updates.push(`"storeId" = $${values.length}`);
    }
    if (strength !== undefined) {
      values.push(strength);
      updates.push(`strength = $${values.length}`);
    }
    if (requiresPrescription !== undefined) {
      values.push(requiresPrescription === "true" || requiresPrescription === true);
      updates.push(`"requiresPrescription" = $${values.length}`);
    }
    if (tags !== undefined) {
      values.push(Array.isArray(tags) ? tags : []);
      updates.push(`tags = $${values.length}`);
    }
    if (prescriptionPlans !== undefined) {
      values.push(prescriptionPlans);
      updates.push(`"prescriptionPlans" = $${values.length}`);
    }

    if (req.user?.role !== "superAdmin") {
      values.push("pending");
      updates.push(`status = $${values.length}`);
    }

    if (Array.isArray(colorImagePairs)) {
      const productImages = extractProductImages(colorImagePairs);
      if (productImages.length > 0) {
        values.push(productImages);
        updates.push(`images = $${values.length}`);
      }
    }

    values.push(new Date());
    updates.push(`"updatedAt" = $${values.length}`);

    if (updates.length > 0) {
      await client.query(
        `UPDATE "Product"
         SET ${updates.join(", ")}
         WHERE id = $1`,
        values,
      );
    }

    if (Array.isArray(colorImagePairs)) {
      await client.query(`DELETE FROM "ProductColor" WHERE "productId" = $1`, [id]);
      await insertProductColors(client, id, colorImagePairs);
    }

    await client.query("COMMIT");

    const updatedProduct = await getProductById(id);
    res.json(updatedProduct);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Product Error:", error.message, error.stack);
    res.status(400).json({
      message: "Product update protocol deviation",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM "Product"
       WHERE id = $1
       RETURNING
         id,
         title,
         slug,
         description,
         price,
         "oldPrice" AS "oldPrice",
         category,
         subcategory,
         brand,
         quantity,
         sold,
         "postedByUserId" AS "postedByUserId",
         "storeId" AS "storeId",
         status,
         "rejectionReason" AS "rejectionReason",
         images,
         strength,
         "requiresPrescription" AS "requiresPrescription",
         "prescriptionPlans" AS "prescriptionPlans",
         tags,
         discount,
         "totalRating" AS "totalRating",
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ ...rows[0], _id: rows[0].id });
  } catch (error) {
    throw new Error(error.message);
  }
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ProductApproved, rejectionReason } = req.body;
  const status = String(ProductApproved || "").toLowerCase();

  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid product status" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE "Product"
       SET status = $2, "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING
         id,
         title,
         slug,
         description,
         price,
         "oldPrice" AS "oldPrice",
         category,
         subcategory,
         brand,
         quantity,
         sold,
         "postedByUserId" AS "postedByUserId",
         "storeId" AS "storeId",
         status,
         "rejectionReason" AS "rejectionReason",
         images,
         strength,
         "requiresPrescription" AS "requiresPrescription",
         "prescriptionPlans" AS "prescriptionPlans",
         tags,
         discount,
         "totalRating" AS "totalRating",
         "createdAt" AS "createdAt",
         "updatedAt" AS "updatedAt"`,
      [id, status, rejectionReason ?? null],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ ...rows[0], _id: rows[0].id });
  } catch (error) {
    throw new Error(error.message);
  }
});

const getStoreProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p."storeId" = $1 AND p.status = 'approved'
     ORDER BY p."createdAt" DESC`,
    [req.params.id],
  );

  res.json(products);
});

const getProductCountByCategory = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT category, COUNT(id)::int AS count
     FROM "Product"
     WHERE "postedByUserId" = $1
     GROUP BY category
     ORDER BY category ASC`,
    [req.params.id],
  );

  res.json({ success: true, data: rows });
});

const AllGetProductCountByCategory = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT category, COUNT(id)::int AS count
     FROM "Product"
     GROUP BY category
     ORDER BY category ASC`,
  );

  res.json({ success: true, data: rows });
});

const fetchRecentProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p."postedByUserId" = $1
     ORDER BY p."createdAt" DESC
     LIMIT 10`,
    [req.params.id],
  );

  res.json({ data: products });
});

const AllfetchRecentProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p.status = 'approved'
     ORDER BY p."createdAt" DESC
     LIMIT 10`,
  );

  res.json({ data: products });
});

const EachMerchantProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p."postedByUserId" = $1
     ORDER BY p."createdAt" DESC`,
    [req.params.id],
  );

  res.json({ data: products });
});

const AllMerchantProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     ORDER BY p."createdAt" DESC`,
  );

  res.json({ data: products });
});

const NotApprovedProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p.status = 'pending'
     ORDER BY p."createdAt" DESC`,
  );

  res.json({
    products,
    pagination: { currentPage: 1, totalPages: 1, totalCount: products.length },
  });
});

const RejectedProducts = asyncHandler(async (req, res) => {
  const products = await fetchProducts(
    `${PRODUCT_SELECT}
     WHERE p.status = 'rejected'
     ORDER BY p."createdAt" DESC`,
  );

  res.json({
    products,
    pagination: { currentPage: 1, totalPages: 1, totalCount: products.length },
  });
});

const addToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const productId = req.body.productId || req.body.id;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  await db.query(
    `INSERT INTO "Wishlist" ("userId", "productId")
     VALUES ($1, $2)
     ON CONFLICT ("userId", "productId") DO NOTHING`,
    [userId, productId],
  );

  res.status(201).json({ message: "Product added to wishlist successfully" });
});

const rating = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const productId = req.body.productId || req.body.prodId || req.body.id;
  const ratingValue = Number.parseInt(req.body.star ?? req.body.rating, 10);
  const comment = req.body.comment || "";

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: reviewRows } = await client.query(
      `SELECT id
       FROM "Review"
       WHERE "productId" = $1 AND "userId" = $2
       LIMIT 1`,
      [productId, userId],
    );

    if (reviewRows[0]) {
      await client.query(
        `UPDATE "Review"
         SET rating = $2, comment = $3
         WHERE id = $1`,
        [reviewRows[0].id, ratingValue, comment],
      );
    } else {
      await client.query(
        `INSERT INTO "Review" (rating, comment, "productId", "userId")
         VALUES ($1, $2, $3, $4)`,
        [ratingValue, comment, productId, userId],
      );
    }

    const { rows: averageRows } = await client.query(
      `SELECT COALESCE(AVG(rating), 0)::float8 AS "totalRating"
       FROM "Review"
       WHERE "productId" = $1`,
      [productId],
    );

    await client.query(
      `UPDATE "Product"
       SET "totalRating" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [productId, averageRows[0].totalRating],
    );

    await client.query("COMMIT");

    const product = await getProductById(productId, { includeReviews: true });
    res.json(product);
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = {
  createProduct,
  getaProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getStoreProducts,
  getProductCountByCategory,
  AllGetProductCountByCategory,
  fetchRecentProducts,
  AllfetchRecentProducts,
  EachMerchantProducts,
  AllMerchantProducts,
  NotApprovedProducts,
  RejectedProducts,
  addToWishlist,
  rating,
  getAdminProduct,
};
