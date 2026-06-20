/**
 * B2B Payment Controller — Chapa "Pay Now"
 *
 * Lets a verified B2B buyer pay for an already-placed order via Chapa.
 * Unlike the B2C flow, the order is created first (paymentMethod chosen at
 * checkout) and the buyer can settle it later from the order status page.
 *
 * IMPORTANT: verification sets ONLY the payment columns. It deliberately does
 * NOT touch the legacy `status` or the B2B `procurementStatus` — those remain
 * `PENDING_APPROVAL` until the ops team approves the procurement order.
 */
const dotenv = require("dotenv");
const axios = require("axios");
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const { logAudit } = require("../utils/auditLogger");

dotenv.config();

/**
 * Build the B2B return URL from the configured CHAPA_RETURN_URL origin.
 * e.g. https://pulseaddis.com/payment/success -> https://pulseaddis.com/b2b/payment/success
 * Falls back to the raw CHAPA_RETURN_URL if it cannot be parsed.
 */
const getB2bReturnUrl = () => {
  const base = process.env.CHAPA_RETURN_URL;
  if (!base) return undefined;
  try {
    const url = new URL(base);
    url.pathname = "/b2b/payment/success";
    url.search = "";
    return url.toString();
  } catch {
    return base;
  }
};

/** Normalize an Ethiopian phone number to the format Chapa expects: 09XXXXXXXX or 07XXXXXXXX (10 digits).
 *  Returns null if the number cannot be normalized to a valid format. */
const normalizePhone = (raw) => {
  if (!raw) return null;
  let cleaned = String(raw).trim().replace(/[^\d+]/g, "");
  // +251XXXXXXXXX → 0XXXXXXXXX
  if (cleaned.startsWith("+251")) cleaned = "0" + cleaned.slice(4);
  // 251XXXXXXXXX (12 digits) → 0XXXXXXXXX
  else if (cleaned.startsWith("251") && cleaned.length === 12) cleaned = "0" + cleaned.slice(3);
  // 7XXXXXXXX or 9XXXXXXXX (9 digits, no leading 0) → 07/09XXXXXXXX
  if (/^[79]\d{8}$/.test(cleaned)) cleaned = "0" + cleaned;
  // Validate: must be exactly 10 digits starting with 07 or 09
  if (/^0[79]\d{8}$/.test(cleaned)) return cleaned;
  return null;
};

/**
 * POST /api/b2b/orders/:id/pay
 * Initialize a Chapa checkout for an existing B2B order.
 * Returns { payment_url } the client redirects to.
 */
const initializeB2bPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }
  if (order.userId !== userId) {
    return res.status(403).json({ success: false, error: "Unauthorized access to order." });
  }

  // Only allow payment when the order is in a payable state.
  if (order.paymentStatus === "PAID") {
    return res.status(400).json({ success: false, error: "This order has already been paid." });
  }
  if (order.procurementStatus === "CANCELLED") {
    return res.status(400).json({ success: false, error: "This order has been cancelled." });
  }

  const amount = Math.max(1, Math.round(parseFloat(order.totalPrice || 0) * 100) / 100);
  if (isNaN(amount) || amount < 1) {
    return res.status(400).json({ success: false, error: "Invalid order total. Cannot initialize payment." });
  }

  // Reuse the order's existing txRef (b2b-...) so verification can match it.
  const txRef = order.txRef;

  const normalizedPhone = normalizePhone(order.phone);
  if (!normalizedPhone) {
    return res.status(400).json({
      success: false,
      message: "Payment initialization failed",
      error: {
        message: "Invalid phone number on order. Please update your profile with a valid Ethiopian phone number (e.g. 0912345678).",
        status: "failed",
        data: null
      }
    });
  }

  try {
    const chapaResponse = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        amount,
        currency: "ETB",
        tx_ref: txRef,
        callback_url: process.env.CHAPA_CALLBACK_URL,
        return_url: getB2bReturnUrl(),
        first_name: order.firstName || "B2B",
        last_name: order.lastName || "Customer",
        email: order.email,
        phone_number: normalizedPhone,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (chapaResponse.data.status !== "success") {
      return res.status(400).json({ success: false, error: "Payment initialization failed." });
    }

    // Mark the order as awaiting payment and persist the txRef if it was missing.
    await db.order.updateMany({
      where: { id },
      data: { paymentStatus: "PENDING" },
    });

    await logAudit("B2B_PAYMENT_INITIALIZED", "Order", id, userId, { txRef, amount });

    res.status(200).json({
      success: true,
      payment_url: chapaResponse.data.data.checkout_url,
      tx_ref: txRef,
    });
  } catch (error) {
    console.error("B2B Chapa initialize error:", error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: "Payment initialization failed",
      error: error.response ? error.response.data : error.message,
    });
  }
});

/**
 * GET /api/b2b/orders/verify-payment?tx_ref=
 * Verify a Chapa transaction for a B2B order and mark it PAID.
 * Does NOT change procurementStatus or legacy status.
 */
const verifyB2bPayment = asyncHandler(async (req, res) => {
  const { tx_ref } = req.query;
  if (!tx_ref) {
    return res.status(400).json({ success: false, error: "tx_ref query parameter is required." });
  }

  try {
    const verifyResponse = await axios.get(
      `https://api.chapa.co/v1/transaction/verify/${tx_ref}`,
      { headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` } }
    );

    if (verifyResponse.data.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment verification failed." });
    }

    const chapaReference = verifyResponse.data.data?.reference || verifyResponse.data.data?.tx_ref || null;

    const updated = await db.order.updateMany({
      where: { txRef: tx_ref },
      data: {
        paymentStatus: "PAID",
        paymentMethod: "PREPAID",
        chapaPaymentId: chapaReference,
        paidAt: new Date(),
      },
    });

    const order = await db.order.findUnique({
      where: { txRef: tx_ref },
      include: { items: { include: { product: true } } },
    });

    if (order) {
      await logAudit("B2B_PAYMENT_VERIFIED", "Order", order.id, order.userId, {
        txRef: tx_ref,
        chapaPaymentId: chapaReference,
      });
    }

    // Real-time notification — buyer + admins + dashboard refresh.
    const { emitToAdmins, emitToUser } = require("../utils/socketEmitter");
    emitToAdmins("b2b:payment:verified", { order });
    emitToAdmins("dashboard:refresh", { source: "b2b_payment_verified" });
    if (order) emitToUser(order.userId, "b2b:payment:verified", { order });

    res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      data: order,
      updated,
    });
  } catch (error) {
    console.error("B2B Chapa verify error:", error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { initializeB2bPayment, verifyB2bPayment };
