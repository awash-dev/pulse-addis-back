/**
 * B2B Customer Controller
 *
 * Admin-only endpoints for managing B2B customers:
 * verification, credit limits, payment terms, customer listing.
 */
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const { logAudit } = require("../utils/auditLogger");

/**
 * GET /api/b2b/admin/customers
 * List all B2B customers (users with customerType set).
 * Filters: customerType, isVerified, paymentTerms, search
 */
const getB2bCustomers = asyncHandler(async (req, res) => {
  const { customerType, isVerified, paymentTerms, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const params = [];
  let paramIdx = 1;
  const whereParts = [`"customerType" IS NOT NULL`];

  if (customerType) {
    whereParts.push(`"customerType" = $${paramIdx}`);
    params.push(customerType);
    paramIdx++;
  }

  if (isVerified !== undefined) {
    whereParts.push(`"isVerified" = $${paramIdx}`);
    params.push(isVerified === "true");
    paramIdx++;
  }

  if (paymentTerms) {
    whereParts.push(`"paymentTerms" = $${paramIdx}`);
    params.push(paymentTerms);
    paramIdx++;
  }

  if (search) {
    whereParts.push(`("institutionName" ILIKE $${paramIdx} OR "firstname" ILIKE $${paramIdx} OR "lastname" ILIKE $${paramIdx} OR "email" ILIKE $${paramIdx} OR "businessLicenseNumber" ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSQL = whereParts.join(" AND ");

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM "User" WHERE ${whereSQL}`,
    params
  );

  const dataResult = await db.query(
    `SELECT id, firstname, lastname, email, mobile, "institutionName", "customerType",
            "businessLicenseNumber", "taxIdentificationNumber", "contactPersonName",
            "contactPersonPhone", "creditLimit", "paymentTerms", "isVerified",
            "verificationDocuments", "createdAt"
     FROM "User"
     WHERE ${whereSQL}
     ORDER BY "createdAt" DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    success: true,
    data: dataResult.rows,
    meta: {
      total: countResult.rows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(countResult.rows[0].total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/b2b/admin/customers/:id
 * Full customer detail with purchase history.
 */
const getB2bCustomerDetail = asyncHandler(async (req, res) => {
  const customer = await db.query(
    `SELECT id, firstname, lastname, email, mobile, address, "profilePictures",
            "institutionName", "customerType", "businessLicenseNumber",
            "taxIdentificationNumber", "contactPersonName", "contactPersonPhone",
            "creditLimit", "paymentTerms", "isVerified", "verificationDocuments",
            "b2bApprovedById", "b2bApprovedAt", "createdAt", "updatedAt"
     FROM "User" WHERE id = $1`,
    [req.params.id]
  );

  if (!customer.rows.length) {
    return res.status(404).json({ success: false, error: "Customer not found." });
  }

  // Get order history
  const orders = await db.query(
    `SELECT id, "orderType", "procurementStatus", status, "totalPrice",
            "totalPriceAfterDiscount", "creditPurchase", "createdAt"
     FROM "Order"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT 50`,
    [req.params.id]
  );

  // Get lifetime spend
  const spendResult = await db.query(
    `SELECT COALESCE(SUM("totalPrice"), 0)::numeric AS "lifetimeSpend",
            COUNT(*)::int AS "totalOrders"
     FROM "Order"
     WHERE "userId" = $1`,
    [req.params.id]
  );

  // Get saved addresses
  const addresses = await db.address.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    success: true,
    data: {
      ...customer.rows[0],
      orders: orders.rows,
      addresses,
      lifetimeSpend: parseFloat(spendResult.rows[0].lifetimeSpend),
      totalOrders: spendResult.rows[0].totalOrders,
    },
  });
});

/**
 * PUT /api/b2b/admin/customers/:id/verify
 * Approve or reject a B2B customer.
 * Body: { action: "approve" | "reject", reason?: string }
 */
const verifyCustomer = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const customerId = req.params.id;

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ success: false, error: "Action must be 'approve' or 'reject'." });
  }

  const customer = await db.user.findUnique({ where: { id: customerId } });
  if (!customer) {
    return res.status(404).json({ success: false, error: "Customer not found." });
  }

  const updateData = {
    isVerified: action === "approve",
    b2bApprovedById: req.user.id,
    b2bApprovedAt: new Date(),
  };

  const updated = await db.user.update({
    where: { id: customerId },
    data: updateData,
  });

  await logAudit(
    action === "approve" ? "CUSTOMER_VERIFIED" : "CUSTOMER_REJECTED",
    "User",
    customerId,
    req.user.id,
    { action, reason: reason || null }
  );

  res.json({
    success: true,
    data: {
      id: updated.id,
      isVerified: updated.isVerified,
      b2bApprovedAt: updated.b2bApprovedAt,
    },
    message: `Customer ${action === "approve" ? "approved" : "rejected"} successfully.`,
  });
});

/**
 * PUT /api/b2b/admin/customers/:id/credit
 * Set credit limit and payment terms.
 * Body: { creditLimit: number, paymentTerms: string }
 */
const setCustomerCredit = asyncHandler(async (req, res) => {
  const { creditLimit, paymentTerms } = req.body;
  const customerId = req.params.id;

  const validTerms = ["PREPAID", "NET_30", "NET_60", "NET_90"];
  if (paymentTerms && !validTerms.includes(paymentTerms)) {
    return res.status(400).json({
      success: false,
      error: `paymentTerms must be one of: ${validTerms.join(", ")}`,
    });
  }

  const updateData = {};
  if (creditLimit !== undefined) updateData.creditLimit = parseFloat(creditLimit);
  if (paymentTerms) updateData.paymentTerms = paymentTerms;

  if (!Object.keys(updateData).length) {
    return res.status(400).json({ success: false, error: "No fields to update." });
  }

  const updated = await db.user.update({
    where: { id: customerId },
    data: updateData,
  });

  await logAudit("CUSTOMER_CREDIT_UPDATED", "User", customerId, req.user.id, updateData);

  res.json({
    success: true,
    data: {
      id: updated.id,
      creditLimit: updated.creditLimit,
      paymentTerms: updated.paymentTerms,
    },
    message: "Customer credit settings updated.",
  });
});

const { v4: uuidv4 } = require("uuid");

/**
 * GET /api/b2b/profile
 * Get B2B profile of the logged-in user.
 * Returns partial profile even if user has no customerType set.
 */
const getB2bProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const customer = await db.query(
    `SELECT id, firstname, lastname, email, mobile,
            "institutionName", "customerType", "businessLicenseNumber",
            "taxIdentificationNumber", "contactPersonName", "contactPersonPhone",
            "creditLimit", "paymentTerms", "isVerified", "verificationDocuments",
            "createdAt"
     FROM "User" WHERE id = $1`,
    [userId]
  );

  if (!customer.rows.length) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  let addresses = [];
  try {
    addresses = await db.address.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (_) {
    addresses = [];
  }

  res.json({
    success: true,
    data: {
      ...customer.rows[0],
      addresses,
    },
  });
});

/**
 * POST /api/b2b/addresses
 * Add shipping address.
 */
const addB2bAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { label, recipientName, phone, line1, line2, city, region, country, postalCode, isDefault } = req.body;

  if (!recipientName || !phone || !line1 || !city) {
    return res.status(400).json({ success: false, error: "Missing required fields." });
  }

  const id = uuidv4();
  const now = new Date();

  if (isDefault) {
    await db.query(`UPDATE "Address" SET "isDefault" = false WHERE "userId" = $1`, [userId]);
  }

  const result = await db.query(
    `INSERT INTO "Address" (
      id, "userId", label, "recipientName", phone, line1, line2, city, region, country, "postalCode", "isDefault", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      id,
      userId,
      label || "Shipping Address",
      recipientName,
      phone,
      line1,
      line2 || null,
      city,
      region || null,
      country || "Ethiopia",
      postalCode || null,
      isDefault || false,
      now,
      now,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

/**
 * DELETE /api/b2b/addresses/:id
 */
const deleteB2bAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const address = await db.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) {
    return res.status(404).json({ success: false, error: "Address not found or unauthorized." });
  }

  await db.address.delete({ where: { id } });

  res.json({ success: true, message: "Address deleted." });
});

module.exports = {
  getB2bCustomers,
  getB2bCustomerDetail,
  verifyCustomer,
  setCustomerCredit,
  getB2bProfile,
  addB2bAddress,
  deleteB2bAddress,
};
