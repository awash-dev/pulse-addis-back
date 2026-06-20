/**
 * B2B Order Controller
 *
 * Handles B2B order placement, tracking, PO upload, and admin management.
 * Includes MOQ checks, tier pricing calculations, and B2B credit limit checks.
 */
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const { calculatePrice, validateMOQ } = require("../utils/tierPricing");
const { logAudit } = require("../utils/auditLogger");
const { v4: uuidv4 } = require("uuid");

/**
 * POST /api/b2b/orders
 * Place a B2B order.
 * Body: { items: [{ productId, quantity }], paymentMethod: "PREPAID" | "CREDIT", shippingAddressId, purchaseOrderNumber, purchaseOrderFileUrl, b2bNotes, sourceRfqId }
 */
const placeB2bOrder = asyncHandler(async (req, res) => {
  const {
    items,
    paymentMethod = "PREPAID",
    shippingAddressId,
    purchaseOrderNumber,
    purchaseOrderFileUrl,
    b2bNotes,
    sourceRfqId,
  } = req.body;

  const userId = req.user.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "Items array is required and cannot be empty." });
  }

  if (!shippingAddressId) {
    return res.status(400).json({ success: false, error: "shippingAddressId is required." });
  }

  // Fetch B2B customer (user) details to check verification and credit limit
  const customer = await db.user.findUnique({ where: { id: userId } });
  if (!customer) {
    return res.status(404).json({ success: false, error: "Customer profile not found." });
  }

  if (!customer.isVerified && paymentMethod !== "PREPAID") {
    return res.status(403).json({
      success: false,
      error: "Your B2B account is not verified yet. Verification is required to place wholesale orders with this payment method.",
    });
  }

  // Fetch Shipping Address
  const shippingAddress = await db.address.findUnique({ where: { id: shippingAddressId } });
  if (!shippingAddress || shippingAddress.userId !== userId) {
    return res.status(400).json({ success: false, error: "Invalid shipping address." });
  }

  // Process items, validate MOQ, stock, and calculate prices
  let orderTotal = 0;
  const processedItems = [];

  for (const item of items) {
    const { productId, quantity } = item;
    const qty = parseInt(quantity);

    if (!productId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: "Invalid item product ID or quantity." });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, error: `Product with ID ${productId} not found.` });
    }

    // Validate MOQ and caseQuantity
    const moqValidation = validateMOQ(product, qty);
    if (!moqValidation.valid) {
      return res.status(400).json({
        success: false,
        error: `MOQ / Case validation failed for ${product.title}: ${moqValidation.error}`,
        correctedQty: moqValidation.correctedQty,
      });
    }

    // Validate inventory stock
    if (product.quantity < qty) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock for product: ${product.title}. Available: ${product.quantity}, Requested: ${qty}`,
      });
    }

    // Calculate price based on wholesale price and tiers
    const priceCalculation = calculatePrice(product, qty);

    processedItems.push({
      productId,
      quantity: qty,
      price: priceCalculation.unitPrice, // unit price for legacy table column
      size: product.unitOfSale || "standard",
      unitPrice: priceCalculation.unitPrice,
      tierPriceApplied: priceCalculation.tierApplied,
      deliveredQuantity: 0,
      batchNumber: product.batchNumber || null,
      expiryDate: product.expiryDate || null,
      // Keep track of decrement amount for later
      productRecord: product,
    });

    orderTotal += priceCalculation.totalPrice;
  }

  // Handle Credit Purchase Checks
  const isCredit = paymentMethod === "CREDIT";
  if (isCredit) {
    if (customer.paymentTerms === "PREPAID") {
      return res.status(400).json({
        success: false,
        error: "Your account does not support credit purchases. Payment terms set to PREPAID.",
      });
    }

    // Calculate active unpaid credit spend
    const activeSpendResult = await db.query(
      `SELECT COALESCE(SUM("totalPrice"), 0)::numeric AS "activeCredit"
       FROM "Order"
       WHERE "userId" = $1
         AND "creditPurchase" = true
         AND "procurementStatus" NOT IN ('DELIVERED', 'CANCELLED')`,
      [userId]
    );
    const activeCredit = parseFloat(activeSpendResult.rows[0].activeCredit);
    const creditLimit = parseFloat(customer.creditLimit || 0);

    if (activeCredit + orderTotal > creditLimit) {
      return res.status(400).json({
        success: false,
        error: `Credit limit exceeded. Current outstanding balance: ${activeCredit}, Order total: ${orderTotal}, Credit limit: ${creditLimit}`,
      });
    }
  }

  // Determine orderType
  let orderType = "BULK";
  if (isCredit) orderType = "CREDIT";
  else if (sourceRfqId) orderType = "RFQ";

  // Create the order and nested order items in a transaction-like manner
  const orderId = uuidv4();
  const txRef = `b2b-${Date.now()}`;
  const now = new Date();

  // Insert Order
  const orderResult = await db.query(
    `INSERT INTO "Order" (
      "id", "userId", "firstName", "lastName", "email", "phone",
      "address", "city", "country", "postalCode", "txRef", "totalPrice",
      "totalPriceAfterDiscount", "status", "prescriptionStatus", "prescriptionImages",
      "month", "createdAt", "updatedAt", "orderType", "procurementStatus",
      "purchaseOrderNumber", "purchaseOrderFileUrl", "creditPurchase", "deliveryType",
      "b2bNotes", "sourceRfqId", "paymentStatus", "paymentMethod"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
    RETURNING *`,
    [
      orderId,
      userId,
      customer.firstname,
      customer.lastname,
      customer.email,
      shippingAddress.phone || customer.mobile,
      `${shippingAddress.line1}${shippingAddress.line2 ? ", " + shippingAddress.line2 : ""}`,
      shippingAddress.city,
      shippingAddress.country,
      parseInt(shippingAddress.postalCode) || 0,
      txRef,
      orderTotal,
      orderTotal,
      "pending", // Legacy status
      "not_required",
      JSON.stringify([]),
      now.getMonth() + 1,
      now,
      now,
      orderType,
      "PENDING_APPROVAL", // B2B status
      purchaseOrderNumber || null,
      purchaseOrderFileUrl || null,
      isCredit,
      "FULL",
      b2bNotes || null,
      sourceRfqId || null,
      "UNPAID",                 // paymentStatus — buyer pays via Chapa "Pay Now" later
      paymentMethod || null,    // paymentMethod — chosen terms (PREPAID/CREDIT/...)
    ]
  );

  const createdOrder = orderResult.rows[0];

  // Insert OrderItems and Decrement stock
  for (const item of processedItems) {
    await db.query(
      `INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "quantity", "price", "size",
        "unitPrice", "tierPriceApplied", "deliveredQuantity", "batchNumber", "expiryDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        uuidv4(),
        orderId,
        item.productId,
        item.quantity,
        item.price,
        item.size,
        item.unitPrice,
        item.tierPriceApplied,
        item.deliveredQuantity,
        item.batchNumber,
        item.expiryDate,
      ]
    );

    // Decrement stock
    await db.query(
      `UPDATE "Product"
       SET quantity = quantity - $1,
           "availabilityStatus" = CASE WHEN quantity - $1 <= 0 THEN 'OUT_OF_STOCK'::"AvailabilityStatus"
                                       WHEN quantity - $1 <= "reorderLevel" THEN 'LOW_STOCK'::"AvailabilityStatus"
                                       ELSE "availabilityStatus" END
       WHERE id = $2`,
      [item.quantity, item.productId]
    );
  }

  // Log Audit Trail
  await logAudit("B2B_ORDER_CREATED", "Order", orderId, userId, {
    total: orderTotal,
    paymentMethod,
    creditUsed: isCredit ? orderTotal : 0,
  });

  // Fetch fully populated order with items for response
  const completeOrder = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  res.status(201).json({
    success: true,
    message: "B2B Order placed successfully.",
    data: completeOrder,
  });

  // Real-time notifications
  const { emitToAdmins, emitToUser } = require("../utils/socketEmitter");
  emitToAdmins("b2b:order:created", { order: completeOrder });
  emitToAdmins("dashboard:refresh", { source: "b2b_order_created" });
  emitToUser(userId, "b2b:order:created", { order: completeOrder });
});

/**
 * GET /api/b2b/orders
 * Get current customer's B2B orders.
 */
const getMyB2bOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { procurementStatus } = req.query;

  const where = {
    userId,
    orderType: { in: ["STANDARD", "BULK", "RFQ", "CREDIT"] },
  };

  if (procurementStatus) {
    where.procurementStatus = procurementStatus;
  }

  const orders = await db.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, data: orders });
});

/**
 * GET /api/b2b/orders/:id
 * Get single B2B order detail (buyer or admin).
 */
const getB2bOrderDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = ["admin", "superAdmin"].includes(req.user.role);

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          mobile: true,
          institutionName: true,
          customerType: true,
        },
      },
      items: { include: { product: true } },
    },
  });

  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  // Authorization check: User must own the order or be an admin
  if (!isAdmin && order.userId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized access to order." });
  }

  res.json({ success: true, data: order });
});

/**
 * POST /api/b2b/orders/:id/upload-po
 * Customer uploads PO document for pending order.
 */
const uploadPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { purchaseOrderFileUrl, purchaseOrderNumber } = req.body;
  const userId = req.user.id;

  if (!purchaseOrderFileUrl) {
    return res.status(400).json({ success: false, error: "purchaseOrderFileUrl is required." });
  }

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  if (order.userId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized." });
  }

  const updated = await db.order.update({
    where: { id },
    data: {
      purchaseOrderFileUrl,
      purchaseOrderNumber: purchaseOrderNumber || order.purchaseOrderNumber,
    },
  });

  await logAudit("PO_UPLOADED", "Order", id, userId, { purchaseOrderNumber });

  res.json({
    success: true,
    message: "Purchase Order uploaded successfully.",
    data: updated,
  });
});

/**
 * GET /api/b2b/admin/orders
 * Admin-only list of B2B orders with filtering.
 */
const getAdminB2bOrders = asyncHandler(async (req, res) => {
  const { procurementStatus, orderType, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const params = [];
  let paramIdx = 1;
  const whereParts = [`o."orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')`];

  if (procurementStatus) {
    whereParts.push(`o."procurementStatus" = $${paramIdx}`);
    params.push(procurementStatus);
    paramIdx++;
  }

  if (orderType) {
    whereParts.push(`o."orderType" = $${paramIdx}`);
    params.push(orderType);
    paramIdx++;
  }

  if (search) {
    whereParts.push(`(u."institutionName" ILIKE $${paramIdx} OR o."firstName" ILIKE $${paramIdx} OR o."lastName" ILIKE $${paramIdx} OR o."txRef" ILIKE $${paramIdx} OR o."purchaseOrderNumber" ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSQL = whereParts.join(" AND ");

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM "Order" o LEFT JOIN "User" u ON o."userId" = u.id WHERE ${whereSQL}`,
    params
  );
  const total = countResult.rows[0].total;

  const dataResult = await db.query(
    `SELECT o.*,
            json_build_object('id', u.id, 'firstname', u.firstname, 'lastname', u.lastname, 'email', u.email, 'institutionName', u."institutionName") AS user
     FROM "Order" o
     LEFT JOIN "User" u ON o."userId" = u.id
     WHERE ${whereSQL}
     ORDER BY o."createdAt" DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    success: true,
    data: dataResult.rows,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * PUT /api/b2b/admin/orders/:id/approve
 * Admin approves a B2B order.
 */
const approveB2bOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  if (order.procurementStatus !== "PENDING_APPROVAL") {
    return res.status(400).json({
      success: false,
      error: `Order cannot be approved in its current state: ${order.procurementStatus}`,
    });
  }

  const updated = await db.order.update({
    where: { id },
    data: {
      procurementStatus: "APPROVED",
      status: "assigned", // sync to legacy status so delivery boys can see it
      approvedById: adminId,
      approvedAt: new Date(),
    },
  });

  await logAudit("B2B_ORDER_APPROVED", "Order", id, adminId);

  res.json({
    success: true,
    message: "B2B Order approved successfully.",
    data: updated,
  });

  const { emitToAdmins, emitToUser } = require("../utils/socketEmitter");
  emitToAdmins("b2b:order:updated", { order: updated });
  emitToUser(order.userId, "b2b:order:updated", { order: updated });
  emitToAdmins("dashboard:refresh", { source: "b2b_order_approved" });
});

/**
 * PUT /api/b2b/admin/orders/:id/status
 * Admin updates procurement status and item delivery details.
 * Body: { status: ProcurementStatus, deliveredQuantities: { [orderItemId]: quantity }, proformaInvoiceUrl, taxInvoiceUrl }
 */
const updateB2bOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, deliveredQuantities, proformaInvoiceUrl, taxInvoiceUrl } = req.body;
  const adminId = req.user.id;

  const order = await db.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  const updateData = {};
  if (status) {
    updateData.procurementStatus = status;

    // Sync status with legacy OrderStatus enum ('pending', 'assigned', 'active', 'delivered')
    if (status === "DELIVERED") {
      updateData.status = "delivered";
    } else if (status === "SHIPPED" || status === "PARTIALLY_SHIPPED" || status === "PROCESSING") {
      updateData.status = "active";
    } else if (status === "CANCELLED") {
      // Revert stock if cancelled
      for (const item of order.items) {
        await db.query(
          `UPDATE "Product"
           SET quantity = quantity + $1,
               "availabilityStatus" = CASE WHEN quantity + $1 > 0 AND "availabilityStatus" = 'OUT_OF_STOCK' THEN 'IN_STOCK'::"AvailabilityStatus" ELSE "availabilityStatus" END
           WHERE id = $2`,
          [item.quantity, item.productId]
        );
      }
      // Set legacy status
      updateData.status = "pending";
    }
  }

  if (proformaInvoiceUrl) updateData.proformaInvoiceUrl = proformaInvoiceUrl;
  if (taxInvoiceUrl) updateData.taxInvoiceUrl = taxInvoiceUrl;

  const updatedOrder = await db.order.update({
    where: { id },
    data: updateData,
  });

  // Update delivered quantities if provided
  if (deliveredQuantities && typeof deliveredQuantities === "object") {
    for (const [itemId, qty] of Object.entries(deliveredQuantities)) {
      const parsedQty = parseInt(qty);
      const matchItem = order.items.find((i) => i.id === itemId);

      if (matchItem && !isNaN(parsedQty) && parsedQty >= 0 && parsedQty <= matchItem.quantity) {
        await db.query(`UPDATE "OrderItem" SET "deliveredQuantity" = $1 WHERE id = $2`, [parsedQty, itemId]);
      }
    }
  }

  await logAudit("B2B_ORDER_STATUS_UPDATED", "Order", id, adminId, {
    status,
    deliveredQuantities,
  });

  const finalOrder = await db.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  res.json({
    success: true,
    message: `Order status updated to ${status || finalOrder.procurementStatus}`,
    data: finalOrder,
  });

  const { emitToAdmins, emitToUser } = require("../utils/socketEmitter");
  emitToAdmins("b2b:order:updated", { order: finalOrder });
  emitToUser(finalOrder.userId, "b2b:order:updated", { order: finalOrder });
  emitToAdmins("dashboard:refresh", { source: "b2b_order_status_updated" });
});

/**
 * PUT /api/b2b/admin/orders/:id/tracking
 * Admin sets the shipment tracking number.
 * Body: { trackingNumber }
 */
const setB2bTrackingNumber = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trackingNumber } = req.body;
  const adminId = req.user.id;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  const updated = await db.order.update({
    where: { id },
    data: { shipmentTrackingNumber: trackingNumber },
  });

  await logAudit("B2B_ORDER_TRACKING_UPDATED", "Order", id, adminId, { trackingNumber });

  res.json({
    success: true,
    message: "Tracking number updated successfully.",
    data: updated,
  });
});

module.exports = {
  placeB2bOrder,
  getMyB2bOrders,
  getB2bOrderDetail,
  uploadPurchaseOrder,
  getAdminB2bOrders,
  approveB2bOrder,
  updateB2bOrderStatus,
  setB2bTrackingNumber,
};
