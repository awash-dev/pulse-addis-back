/**
 * B2B Analytics Controller
 *
 * Provides analytical summaries, sales charts, inventory metrics,
 * and customer insights for administrative decision-making.
 */
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");

/**
 * GET /api/b2b/admin/analytics/overview
 * Overall KPIs: Total B2B sales, order counts, pending RFQs, inventory alert counts.
 */
const getOverviewKPIs = asyncHandler(async (req, res) => {
  // 1. Revenue & Orders
  const orderStats = await db.query(
    `SELECT
       COUNT(*)::int AS "totalOrders",
       COALESCE(SUM("totalPrice"), 0)::numeric AS "totalRevenue",
       COUNT(CASE WHEN "procurementStatus" = 'PENDING_APPROVAL' THEN 1 END)::int AS "pendingApprovalCount",
       COUNT(CASE WHEN "creditPurchase" = true THEN 1 END)::int AS "creditOrdersCount",
       COALESCE(SUM(CASE WHEN "creditPurchase" = true THEN "totalPrice" ELSE 0 END), 0)::numeric AS "creditRevenue"
     FROM "Order"
     WHERE "orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')
       AND "procurementStatus" != 'CANCELLED'`
  );

  // 2. Verified and Pending Customers
  const customerStats = await db.query(
    `SELECT
       COUNT(*)::int AS "totalB2bCustomers",
       COUNT(CASE WHEN "isVerified" = true THEN 1 END)::int AS "verifiedCount",
       COUNT(CASE WHEN "isVerified" = false THEN 1 END)::int AS "pendingVerificationCount"
     FROM "User"
     WHERE "customerType" IS NOT NULL`
  );

  // 3. Pending RFQs
  const rfqStats = await db.query(
    `SELECT
       COUNT(*)::int AS "totalRfqs",
       COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END)::int AS "pendingRfqCount"
     FROM "RequestForQuotation"`
  );

  // 4. Inventory Alerts
  const inventoryStats = await db.query(
    `SELECT
       COUNT(CASE WHEN quantity = 0 THEN 1 END)::int AS "outOfStockCount",
       COUNT(CASE WHEN quantity <= "reorderLevel" AND "reorderLevel" > 0 AND quantity > 0 THEN 1 END)::int AS "lowStockCount",
       COUNT(CASE WHEN "expiryDate" <= NOW() + INTERVAL '90 days' AND "expiryDate" > NOW() THEN 1 END)::int AS "expiringSoonCount",
       COUNT(CASE WHEN "expiryDate" <= NOW() THEN 1 END)::int AS "alreadyExpiredCount"
     FROM "Product"`
  );

  res.json({
    success: true,
    data: {
      sales: {
        totalRevenue: parseFloat(orderStats.rows[0].totalRevenue),
        totalOrders: orderStats.rows[0].totalOrders,
        pendingApproval: orderStats.rows[0].pendingApprovalCount,
        creditOrders: orderStats.rows[0].creditOrdersCount,
        creditRevenue: parseFloat(orderStats.rows[0].creditRevenue),
      },
      customers: {
        total: customerStats.rows[0].totalB2bCustomers,
        verified: customerStats.rows[0].verifiedCount,
        pendingVerification: customerStats.rows[0].pendingVerificationCount,
      },
      rfqs: {
        total: rfqStats.rows[0].totalRfqs,
        pending: rfqStats.rows[0].pendingRfqCount,
      },
      inventory: {
        outOfStock: inventoryStats.rows[0].outOfStockCount,
        lowStock: inventoryStats.rows[0].lowStockCount,
        expiringSoon: inventoryStats.rows[0].expiringSoonCount,
        alreadyExpired: inventoryStats.rows[0].alreadyExpiredCount,
      },
    },
  });
});

/**
 * GET /api/b2b/admin/analytics/sales
 * B2B Sales Trends (grouped by month or payment method) and Category split.
 */
const getSalesAnalytics = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query; // 'month', 'week', 'day'

  let dateTruncField = "month";
  if (period === "week") dateTruncField = "week";
  if (period === "day") dateTruncField = "day";

  // 1. Sales Trend over time
  const salesTrend = await db.query(
    `SELECT
       DATE_TRUNC($1, "createdAt") AS "timePeriod",
       COUNT(*)::int AS "ordersCount",
       COALESCE(SUM("totalPrice"), 0)::numeric AS "revenue"
     FROM "Order"
     WHERE "orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')
       AND "procurementStatus" != 'CANCELLED'
     GROUP BY "timePeriod"
     ORDER BY "timePeriod" ASC
     LIMIT 24`,
    [dateTruncField]
  );

  // 2. Sales by Category
  const categorySales = await db.query(
    `SELECT
       COALESCE(p."b2bCategory"::text, 'UNCATEGORIZED') AS "category",
       COUNT(oi.id)::int AS "itemsSold",
       COALESCE(SUM(oi.quantity * COALESCE(oi."unitPrice", oi.price)), 0)::numeric AS "revenue"
     FROM "OrderItem" oi
     JOIN "Order" o ON oi."orderId" = o.id
     JOIN "Product" p ON oi."productId" = p.id
     WHERE o."orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')
       AND o."procurementStatus" != 'CANCELLED'
     GROUP BY p."b2bCategory"
     ORDER BY "revenue" DESC`
  );

  // 3. Credit vs Cash Sales
  const paymentMethodSales = await db.query(
    `SELECT
       "creditPurchase",
       COUNT(*)::int AS "ordersCount",
       COALESCE(SUM("totalPrice"), 0)::numeric AS "revenue"
     FROM "Order"
     WHERE "orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')
       AND "procurementStatus" != 'CANCELLED'
     GROUP BY "creditPurchase"`
  );

  res.json({
    success: true,
    data: {
      salesTrend: salesTrend.rows.map((row) => ({
        timePeriod: row.timePeriod,
        ordersCount: row.ordersCount,
        revenue: parseFloat(row.revenue),
      })),
      categorySales: categorySales.rows.map((row) => ({
        category: row.category,
        itemsSold: row.itemsSold,
        revenue: parseFloat(row.revenue),
      })),
      paymentMethodSales: paymentMethodSales.rows.map((row) => ({
        paymentMethod: row.creditPurchase ? "CREDIT" : "PREPAID/CASH",
        ordersCount: row.ordersCount,
        revenue: parseFloat(row.revenue),
      })),
    },
  });
});

/**
 * GET /api/b2b/admin/analytics/inventory
 * Stock distribution and Expiry Analysis.
 */
const getInventoryAnalytics = asyncHandler(async (req, res) => {
  // 1. Valuation & Stock counts by Category
  const categoryInventory = await db.query(
    `SELECT
       COALESCE("b2bCategory"::text, 'UNCATEGORIZED') AS "category",
       COUNT(*)::int AS "uniqueProductsCount",
       SUM(quantity)::int AS "totalStock",
       COALESCE(SUM(quantity * COALESCE("wholesalePrice", price)), 0)::numeric AS "valuation"
     FROM "Product"
     GROUP BY "b2bCategory"
     ORDER BY "valuation" DESC`
  );

  // 2. Expiry Buckets
  const expiryBuckets = await db.query(
    `SELECT
       COUNT(CASE WHEN "expiryDate" <= NOW() THEN 1 END)::int AS "expired",
       COUNT(CASE WHEN "expiryDate" > NOW() AND "expiryDate" <= NOW() + INTERVAL '30 days' THEN 1 END)::int AS "under30Days",
       COUNT(CASE WHEN "expiryDate" > NOW() + INTERVAL '30 days' AND "expiryDate" <= NOW() + INTERVAL '90 days' THEN 1 END)::int AS "under90Days",
       COUNT(CASE WHEN "expiryDate" > NOW() + INTERVAL '90 days' AND "expiryDate" <= NOW() + INTERVAL '180 days' THEN 1 END)::int AS "under180Days",
       COUNT(CASE WHEN "expiryDate" > NOW() + INTERVAL '180 days' THEN 1 END)::int AS "safe"
     FROM "Product"
     WHERE "expiryDate" IS NOT NULL`
  );

  res.json({
    success: true,
    data: {
      categoryInventory: categoryInventory.rows.map((row) => ({
        category: row.category,
        uniqueProducts: row.uniqueProductsCount,
        totalStock: row.totalStock || 0,
        valuation: parseFloat(row.valuation),
      })),
      expiryBuckets: {
        expired: expiryBuckets.rows[0].expired,
        under30Days: expiryBuckets.rows[0].under30Days,
        under90Days: expiryBuckets.rows[0].under90Days,
        under180Days: expiryBuckets.rows[0].under180Days,
        safe: expiryBuckets.rows[0].safe,
      },
    },
  });
});

/**
 * GET /api/b2b/admin/analytics/customers
 * Customer metrics: breakdown by customerType, top buyers.
 */
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  // 1. Demographics by Customer Type
  const customerTypes = await db.query(
    `SELECT
       COALESCE("customerType"::text, 'UNKNOWN') AS "customerType",
       COUNT(*)::int AS "count",
       COUNT(CASE WHEN "isVerified" = true THEN 1 END)::int AS "verifiedCount"
     FROM "User"
     WHERE "customerType" IS NOT NULL
     GROUP BY "customerType"
     ORDER BY "count" DESC`
  );

  // 2. Top B2B Buyers by total spend
  const topBuyers = await db.query(
    `SELECT
       u.id,
       u.firstname,
       u.lastname,
       u."institutionName",
       u."customerType",
       COUNT(o.id)::int AS "ordersCount",
       COALESCE(SUM(o."totalPrice"), 0)::numeric AS "totalSpend"
     FROM "User" u
     JOIN "Order" o ON u.id = o."userId"
     WHERE u."customerType" IS NOT NULL
       AND o."orderType" IN ('STANDARD', 'BULK', 'RFQ', 'CREDIT')
       AND o."procurementStatus" != 'CANCELLED'
     GROUP BY u.id
     ORDER BY "totalSpend" DESC
     LIMIT 10`
  );

  res.json({
    success: true,
    data: {
      customerTypes: customerTypes.rows,
      topBuyers: topBuyers.rows.map((row) => ({
        id: row.id,
        firstname: row.firstname,
        lastname: row.lastname,
        institutionName: row.institutionName,
        customerType: row.customerType,
        ordersCount: row.ordersCount,
        totalSpend: parseFloat(row.totalSpend),
      })),
    },
  });
});

module.exports = {
  getOverviewKPIs,
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
};
