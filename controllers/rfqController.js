/**
 * RFQ (Request for Quotation) Controller
 *
 * Handles RFQ submission by buyers, viewing submissions,
 * responding with quotes by admin, and quote acceptance.
 */
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const { logAudit } = require("../utils/auditLogger");
const { v4: uuidv4 } = require("uuid");

/**
 * Helper to populate product details for RFQ items.
 * Expects an array of items [{ productId, quantity, ... }] and returns [{ productId, quantity, product: { ... } }]
 */
const populateRfqItems = async (items) => {
  if (!items || !Array.isArray(items)) return [];

  const productIds = items.map((i) => i.productId).filter(Boolean);
  if (productIds.length === 0) return items;

  // Retrieve products in one query
  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
  const productsResult = await db.query(
    `SELECT id, title, slug, "genericName", "wholesalePrice", images, "unitOfSale"
     FROM "Product"
     WHERE id IN (${placeholders})`,
    productIds
  );

  const productMap = productsResult.rows.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return items.map((item) => ({
    ...item,
    product: productMap[item.productId] || null,
  }));
};

/**
 * POST /api/b2b/rfq
 * Submit a Request for Quotation (RFQ).
 * Body: { items: [{ productId, quantity, targetPrice, notes }], notes }
 */
const submitRfq = asyncHandler(async (req, res) => {
  const { items, notes } = req.body;
  const customerId = req.user.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "Items are required to submit an RFQ." });
  }

  // Verify B2B customer is verified
  const customer = await db.user.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isVerified) {
    return res.status(403).json({
      success: false,
      error: "Only verified B2B customers can request quotes.",
    });
  }

  // Validate items are real products
  for (const item of items) {
    const { productId, quantity } = item;
    if (!productId || isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
      return res.status(400).json({ success: false, error: "Invalid product ID or quantity in items." });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, error: `Product with ID ${productId} not found.` });
    }
  }

  const rfqId = uuidv4();
  const now = new Date();

  // Create RFQ row
  const rfqResult = await db.query(
    `INSERT INTO "RequestForQuotation" (
      id, "customerId", items, status, notes, "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [rfqId, customerId, JSON.stringify(items), "SUBMITTED", notes || null, now, now]
  );

  const createdRfq = rfqResult.rows[0];
  createdRfq.items = await populateRfqItems(createdRfq.items);

  await logAudit("RFQ_SUBMITTED", "RequestForQuotation", rfqId, customerId);

  res.status(201).json({
    success: true,
    message: "RFQ submitted successfully.",
    data: createdRfq,
  });
});

/**
 * GET /api/b2b/rfq
 * Get customer's own RFQs.
 */
const getMyRfqs = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { status } = req.query;

  let querySQL = `SELECT * FROM "RequestForQuotation" WHERE "customerId" = $1`;
  const params = [customerId];

  if (status) {
    querySQL += ` AND status = $2`;
    params.push(status);
  }

  querySQL += ` ORDER BY "createdAt" DESC`;

  const result = await db.query(querySQL, params);

  // Populate products for each RFQ
  const rfqs = [];
  for (const row of result.rows) {
    row.items = await populateRfqItems(row.items);
    if (row.adminResponse) {
      row.adminResponse = await populateRfqItems(row.adminResponse);
    }
    rfqs.push(row);
  }

  res.json({ success: true, data: rfqs });
});

/**
 * GET /api/b2b/rfq/:id
 * Get details of a single RFQ.
 */
const getRfqDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = ["admin", "superAdmin"].includes(req.user.role);

  const result = await db.query(`SELECT * FROM "RequestForQuotation" WHERE id = $1`, [id]);
  const rfq = result.rows[0];

  if (!rfq) {
    return res.status(404).json({ success: false, error: "RFQ not found." });
  }

  if (!isAdmin && rfq.customerId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized access to RFQ." });
  }

  rfq.items = await populateRfqItems(rfq.items);
  if (rfq.adminResponse) {
    rfq.adminResponse = await populateRfqItems(rfq.adminResponse);
  }

  // Fetch customer details
  const customerResult = await db.query(
    `SELECT id, firstname, lastname, email, "institutionName", "customerType" FROM "User" WHERE id = $1`,
    [rfq.customerId]
  );
  rfq.customer = customerResult.rows[0] || null;

  res.json({ success: true, data: rfq });
});

/**
 * GET /api/b2b/admin/rfq
 * Admin list all RFQs.
 */
const getAdminRfqs = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const params = [];
  let paramIdx = 1;
  const whereParts = ["1=1"];

  if (status) {
    whereParts.push(`r.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (search) {
    whereParts.push(`(u."institutionName" ILIKE $${paramIdx} OR u.firstname ILIKE $${paramIdx} OR u.lastname ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSQL = whereParts.join(" AND ");

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM "RequestForQuotation" r LEFT JOIN "User" u ON r."customerId" = u.id WHERE ${whereSQL}`,
    params
  );
  const total = countResult.rows[0].total;

  const dataResult = await db.query(
    `SELECT r.*,
            json_build_object('id', u.id, 'firstname', u.firstname, 'lastname', u.lastname, 'email', u.email, 'institutionName', u."institutionName", 'customerType', u."customerType") AS customer
     FROM "RequestForQuotation" r
     LEFT JOIN "User" u ON r."customerId" = u.id
     WHERE ${whereSQL}
     ORDER BY r."createdAt" DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  // Populate product details in the page of RFQs
  const rfqs = [];
  for (const row of dataResult.rows) {
    row.items = await populateRfqItems(row.items);
    if (row.adminResponse) {
      row.adminResponse = await populateRfqItems(row.adminResponse);
    }
    rfqs.push(row);
  }

  res.json({
    success: true,
    data: rfqs,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * PUT /api/b2b/admin/rfq/:id/respond
 * Admin responds to RFQ with pricing quotes.
 * Body: { adminResponse: [{ productId, quotedPrice, notes }], validDays, notes }
 */
const respondToRfq = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminResponse, validDays = 7, notes } = req.body;
  const adminId = req.user.id;

  if (!adminResponse || !Array.isArray(adminResponse) || adminResponse.length === 0) {
    return res.status(400).json({ success: false, error: "adminResponse containing prices is required." });
  }

  // Fetch RFQ
  const rfqResult = await db.query(`SELECT * FROM "RequestForQuotation" WHERE id = $1`, [id]);
  const rfq = rfqResult.rows[0];

  if (!rfq) {
    return res.status(404).json({ success: false, error: "RFQ not found." });
  }

  // Compute validation dates
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + parseInt(validDays));

  // Update RFQ in DB
  const updateResult = await db.query(
    `UPDATE "RequestForQuotation"
     SET status = 'QUOTED',
         "adminResponse" = $1,
         "respondedById" = $2,
         "respondedAt" = NOW(),
         "validUntil" = $3,
         notes = COALESCE($4, notes),
         "updatedAt" = NOW()
     WHERE id = $5
     RETURNING *`,
    [JSON.stringify(adminResponse), adminId, validUntil, notes || null, id]
  );

  const updatedRfq = updateResult.rows[0];
  updatedRfq.items = await populateRfqItems(updatedRfq.items);
  updatedRfq.adminResponse = await populateRfqItems(updatedRfq.adminResponse);

  await logAudit("RFQ_QUOTED", "RequestForQuotation", id, adminId, { validDays });

  res.json({
    success: true,
    message: "Quote response sent successfully.",
    data: updatedRfq,
  });
});

/**
 * PUT /api/b2b/rfq/:id/accept
 * Customer accepts the quoted price.
 */
const acceptRfqQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const rfqResult = await db.query(`SELECT * FROM "RequestForQuotation" WHERE id = $1`, [id]);
  const rfq = rfqResult.rows[0];

  if (!rfq) {
    return res.status(404).json({ success: false, error: "RFQ not found." });
  }

  if (rfq.customerId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized." });
  }

  if (rfq.status !== "QUOTED") {
    return res.status(400).json({
      success: false,
      error: `RFQ is in status ${rfq.status} and cannot be accepted.`,
    });
  }

  if (rfq.validUntil && new Date(rfq.validUntil) < new Date()) {
    // Automatically set status to EXPIRED
    await db.query(`UPDATE "RequestForQuotation" SET status = 'EXPIRED' WHERE id = $1`, [id]);
    return res.status(400).json({ success: false, error: "The quote validity period has expired." });
  }

  const updateResult = await db.query(
    `UPDATE "RequestForQuotation"
     SET status = 'ACCEPTED',
         "updatedAt" = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  await logAudit("RFQ_ACCEPTED", "RequestForQuotation", id, userId);

  res.json({
    success: true,
    message: "Quote accepted successfully. You can now proceed to check out using this quote.",
    data: updateResult.rows[0],
  });
});

/**
 * PUT /api/b2b/rfq/:id/reject
 * Customer rejects the quoted price.
 */
const rejectRfqQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const rfqResult = await db.query(`SELECT * FROM "RequestForQuotation" WHERE id = $1`, [id]);
  const rfq = rfqResult.rows[0];

  if (!rfq) {
    return res.status(404).json({ success: false, error: "RFQ not found." });
  }

  if (rfq.customerId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized." });
  }

  const updateResult = await db.query(
    `UPDATE "RequestForQuotation"
     SET status = 'REJECTED',
         "updatedAt" = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  await logAudit("RFQ_REJECTED", "RequestForQuotation", id, userId);

  res.json({
    success: true,
    message: "Quote rejected.",
    data: updateResult.rows[0],
  });
});

module.exports = {
  submitRfq,
  getMyRfqs,
  getRfqDetail,
  getAdminRfqs,
  respondToRfq,
  acceptRfqQuote,
  rejectRfqQuote,
};
