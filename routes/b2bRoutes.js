const express = require("express");
const router = express.Router();

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { isVerifiedB2bCustomer } = require("../middlewares/b2bGuard");

const {
  getB2bProducts,
  getAdminB2bProducts,
  getB2bProduct,
  getExpiringSoon,
  getLowStock,
} = require("../controllers/b2bProductController");

const {
  getB2bCustomers,
  getB2bCustomerDetail,
  verifyCustomer,
  setCustomerCredit,
  getB2bProfile,
  addB2bAddress,
  deleteB2bAddress,
} = require("../controllers/b2bCustomerController");

const {
  placeB2bOrder,
  getMyB2bOrders,
  getB2bOrderDetail,
  uploadPurchaseOrder,
  getAdminB2bOrders,
  approveB2bOrder,
  updateB2bOrderStatus,
  setB2bTrackingNumber,
} = require("../controllers/b2bOrderController");

const {
  initializeB2bPayment,
  verifyB2bPayment,
} = require("../controllers/b2bPaymentController");

const {
  submitRfq,
  getMyRfqs,
  getRfqDetail,
  getAdminRfqs,
  respondToRfq,
  acceptRfqQuote,
  rejectRfqQuote,
} = require("../controllers/rfqController");

const {
  getOverviewKPIs,
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
} = require("../controllers/b2bAnalyticsController");

// --- Products ---
router.get("/products", getB2bProducts);
router.get("/admin/products", authMiddleware, isAdmin, getAdminB2bProducts);
router.get("/products/expiring-soon", authMiddleware, isAdmin, getExpiringSoon);
router.get("/products/low-stock", authMiddleware, isAdmin, getLowStock);
router.get("/products/:id", getB2bProduct);

// --- Profile & Addresses (Buyer self-service) ---
router.get("/profile", authMiddleware, getB2bProfile);
router.post("/addresses", authMiddleware, addB2bAddress);
router.delete("/addresses/:id", authMiddleware, deleteB2bAddress);

// --- Customers (Admin only) ---
router.get("/admin/customers", authMiddleware, isAdmin, getB2bCustomers);
router.get("/admin/customers/:id", authMiddleware, isAdmin, getB2bCustomerDetail);
router.put("/admin/customers/:id/verify", authMiddleware, isAdmin, verifyCustomer);
router.put("/admin/customers/:id/credit", authMiddleware, isAdmin, setCustomerCredit);

// --- Orders ---
router.post("/orders", authMiddleware, isVerifiedB2bCustomer, placeB2bOrder);
router.get("/orders", authMiddleware, getMyB2bOrders);
// Static payment route declared BEFORE /orders/:id so Express doesn't treat
// "verify-payment" as an order id.
router.get("/orders/verify-payment", authMiddleware, verifyB2bPayment);
router.post("/orders/:id/pay", authMiddleware, initializeB2bPayment);
router.get("/orders/:id", authMiddleware, getB2bOrderDetail);
router.post("/orders/:id/upload-po", authMiddleware, uploadPurchaseOrder);

router.get("/admin/orders", authMiddleware, isAdmin, getAdminB2bOrders);
router.put("/admin/orders/:id/approve", authMiddleware, isAdmin, approveB2bOrder);
router.put("/admin/orders/:id/status", authMiddleware, isAdmin, updateB2bOrderStatus);
router.put("/admin/orders/:id/tracking", authMiddleware, isAdmin, setB2bTrackingNumber);

// --- RFQ ---
router.post("/rfq", authMiddleware, isVerifiedB2bCustomer, submitRfq);
router.get("/rfq", authMiddleware, getMyRfqs);
router.get("/rfq/:id", authMiddleware, getRfqDetail);
router.put("/rfq/:id/accept", authMiddleware, acceptRfqQuote);
router.put("/rfq/:id/reject", authMiddleware, rejectRfqQuote);

router.get("/admin/rfq", authMiddleware, isAdmin, getAdminRfqs);
router.put("/admin/rfq/:id/respond", authMiddleware, isAdmin, respondToRfq);

// --- Analytics (Admin only) ---
router.get("/admin/analytics/overview", authMiddleware, isAdmin, getOverviewKPIs);
router.get("/admin/analytics/sales", authMiddleware, isAdmin, getSalesAnalytics);
router.get("/admin/analytics/inventory", authMiddleware, isAdmin, getInventoryAnalytics);
router.get("/admin/analytics/customers", authMiddleware, isAdmin, getCustomerAnalytics);

module.exports = router;
