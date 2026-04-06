const dotenv = require("dotenv");
const axios = require("axios");
const db = require("../configure/dbClient.js");

dotenv.config();

const initializePayment = async (req, res) => {
  const {
    totalPrice, currency, email, first_name, tx_ref,
    last_name, phone_number, address, country, city,
    postalCode, totalPriceAfterDiscount, cart,
    prescriptionImages, prescriptionStatus
  } = req.body;

  const userId = req.user?.id || req.user?._id;

  try {
    const chapaResponse = await axios.post("https://api.chapa.co/v1/transaction/initialize", {
      amount: totalPrice,
      currency: "ETB",
      tx_ref: tx_ref,
      callback_url: process.env.CHAPA_CALLBACK_URL,
      return_url: process.env.CHAPA_RETURN_URL,
      first_name,
      last_name,
      email,
      phone_number
    }, {
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (chapaResponse.data.status === "success") {
      // Build order items from cart
      const items = Array.isArray(cart)
        ? cart.map(item => ({
            productId: item.productId || item._id,
            colorId: item.colorId || null,
            quantity: item.quantity || 1,
            price: item.price || 0,
            size: item.size || item.selectedSize || "standard"
          }))
        : [];

      const newOrder = await db.order.create({
        data: {
          userId,
          firstName: first_name,
          lastName: last_name,
          email,
          phone: phone_number,
          address: address || "",
          city: city || "",
          country: country || "Ethiopia",
          postalCode: parseInt(postalCode) || 0,
          txRef: tx_ref,
          totalPrice: parseFloat(totalPrice),
          totalPriceAfterDiscount: parseFloat(totalPriceAfterDiscount || totalPrice),
          prescriptionImages: prescriptionImages || [],
          prescriptionStatus: prescriptionStatus || "not_required",
          status: "pending",
          month: new Date().getMonth() + 1,
          items: {
            create: items
          }
        }
      });

      // Create notification
      await db.notification.create({
        data: {
          userId,
          message: `New order created with ref: ${tx_ref}`,
          read: false
        }
      });

      res.status(200).json({ payment_url: chapaResponse.data.data.checkout_url });
    } else {
      res.status(400).json({ message: "Payment initialization failed" });
    }
  } catch (error) {
    console.error("Chapa payment error:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "Payment failed", error: error.response ? error.response.data : error.message });
  }
};

const verifyPayment = async (req, res) => {
  const { tx_ref } = req.query;
  try {
    const verifyResponse = await axios.get(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` }
    });

    if (verifyResponse.data.status === "success") {
      const order = await db.order.updateMany({
        where: { txRef: tx_ref },
        data: { status: "active" }
      });
      res.status(200).json({ message: "Payment verified successfully", order, success: true });
    } else {
      res.status(400).json({ message: "Payment verification failed", success: false });
    }
  } catch (error) {
    console.error("Chapa verification error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { verifyPayment, initializePayment };
