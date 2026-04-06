const express = require("express");
const {
  createUser,
  createAppUser,
  verifyEmail,
  forgotPassword,
  verifyOTP,
  resetPassword,
  loginUserCtrl,
  getallUser,
  getaUser,
  deleteaUser,
  updatedUser,
  blockUser,
  unblockUser,
  handleRefreshToken,
  logout,
  updatePassword,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  saveAddress,
  userCart,
  getUserCart,
  removeProductFromCart,
  updateProductQuantityFromCart,
  getMyOrders,
  emptyCart,
  getMonthWiseOrderIncome,
  getMonthWiseOrderCount,
  getYearlyTotalOrder,
  getAllOrders,
  getsingleOrder,
  updateOrder,
  getDeliveryBoys,
  assignOrderToDeliveryBoy,
  updateDeliveryBoy,
  deleteDeliveryBoy,
  // new 
  changePassword,
  getUsersByRole,
  getUserCount,

} = require("../controllers/userController");
const { authMiddleware, isAdmin, isSuperAdminOrAdmin, isAdminSuperAdminOrMerchant, isSuperAdminOrMerchant } = require("../middlewares/authMiddleware");
//const { checkout, paymentVerification } = require("../controller/paymentCtrl");
const router = express.Router();

router.get("/getallorders", getAllOrders);
router.get("/all-users", getallUser);
router.get("/getmyorders", authMiddleware, getMyOrders);

router.get("/getMonthWiseOrderIncome", getMonthWiseOrderIncome);
router.get("/getyearlyorders", getYearlyTotalOrder);

router.put('/changepassword/:token', changePassword);
router.get("/userList", getUsersByRole);
router.get("/userCounts", getUserCount);
router.get("/delivery-boys", authMiddleware, getDeliveryBoys);
router.put("/delivery-boys/:id", authMiddleware, isAdmin, updatedUser);
router.delete("/delivery-boys/:id", authMiddleware, isAdmin, deleteaUser);

router.post("/register", createUser);
router.post("/appRegister", createAppUser);
router.post("/verify-email", verifyEmail);

router.put("/ForgotPassword", forgotPassword);
router.post("/verify-otp", verifyOTP);


router.post("/reset-password", resetPassword);
router.put("/password", authMiddleware, updatePassword);
router.post("/login", loginUserCtrl);
router.post("/cart", authMiddleware, userCart);
router.post("/wishlist", authMiddleware, addToWishlist);



router.get("/getaOrder/:id", authMiddleware, isAdminSuperAdminOrMerchant, getsingleOrder);
router.put("/updateOrder/:id", authMiddleware, isSuperAdminOrAdmin, updateOrder);

router.get("/refresh", handleRefreshToken);
router.get("/logout", logout);
router.get("/wishlist", authMiddleware, getWishlist);
router.get("/cart", authMiddleware, getUserCart);



router.delete(
  "/delete-product-cart/:cartItemId",
  authMiddleware,
  removeProductFromCart
);
router.delete(
  "/update-product-cart/:cartItemId/:newQuantity",
  authMiddleware,
  updateProductQuantityFromCart
);

router.delete("/remove-wishlist/:id", authMiddleware, removeFromWishlist); // protect middleware is used for authentication

router.delete("/empty-cart", authMiddleware, emptyCart);

router.put("/edit-user", authMiddleware, updatedUser);
router.put("/save-address", authMiddleware, saveAddress);
router.put("/block-user/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock-user/:id", authMiddleware, isAdmin, unblockUser);

router.get("/:id", getaUser);
router.put("/:id", updatedUser);
router.delete("/:id", deleteaUser);







module.exports = router;
