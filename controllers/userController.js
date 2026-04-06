const prisma = require("../configure/prismaClient");
const asyncHandler = require("express-async-handler");
const { generateToken } = require("../utils/createToken");
const { generateRefreshToken } = require("../utils/refreshtoken");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/sendEmail");
const { validationResult } = require("express-validator");

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Admin creates user (no password from them) ───────────────────────────
const createUser = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, role, mobile } = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existingUser) throw new Error("User already exists with this email.");

  const otpPassword = generateOTP();
  const hashedPassword = await bcrypt.hash(otpPassword, 10);

  const newUser = await prisma.user.create({
    data: {
      firstname, lastname,
      email: email.toLowerCase().trim(),
      role: role || "user",
      mobile,
      password: hashedPassword,
      isEmailVerified: true // admin-created users skip verification
    }
  });

  const token = generateToken(newUser.id);
  const resetUrl = `${process.env.base_url}reset-password?token=${token}`;
  const message = `Your account has been created.\nTemporary password: ${otpPassword}\nReset here: ${resetUrl}`;
  try {
    await sendEmail({ email: newUser.email, subject: "Account Created – Pulse Addis", message });
  } catch (e) { console.error("Email send error:", e.message); }

  res.status(201).json({
    success: true,
    message: "User created successfully.",
    user: { id: newUser.id, firstname: newUser.firstname, lastname: newUser.lastname, email: newUser.email, role: newUser.role }
  });
});

// ─── Client self-registration ──────────────────────────────────────────────
const createAppUser = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, password, mobile, role } = req.body;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) throw new Error("User already exists with this email.");

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  const newUser = await prisma.user.create({
    data: {
      firstname, lastname,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      mobile: mobile || "0000000000",
      role: role || "user",
      emailVerificationOTP: hashedOtp,
      emailVerificationExpires: expires
    }
  });

  const message = `Your OTP for email verification: ${otp}. Valid for 10 minutes.`;
  try {
    await sendEmail({ email: newUser.email, subject: "Email Verification – Pulse Addis", message });
  } catch (e) { console.error("Email send error:", e.message); }

  res.status(201).json({
    success: true,
    message: "Registered successfully. Check your email for OTP.",
    user: { id: newUser.id, firstname: newUser.firstname, email: newUser.email }
  });
});

// ─── Verify Email ──────────────────────────────────────────────────────────
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ message: "User not found" });
  if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
    return res.status(400).json({ message: "OTP has expired" });
  }
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashedOTP !== user.emailVerificationOTP) {
    return res.status(400).json({ message: "Incorrect OTP" });
  }
  await prisma.user.update({
    where: { email },
    data: { isEmailVerified: true, emailVerificationOTP: null, emailVerificationExpires: null }
  });
  res.status(200).json({ message: "Email verified successfully" });
});

// ─── Forgot password ───────────────────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const otpPassword = generateOTP();
  const hashedPassword = await bcrypt.hash(otpPassword, 10);
  const token = generateToken(user.id);
  const resetUrl = `${process.env.base_url}reset-password?token=${token}`;

  await prisma.user.update({ where: { email }, data: { password: hashedPassword } });

  const message = `Reset link: ${resetUrl}\nTemporary password: ${otpPassword}`;
  try {
    await sendEmail({ email: user.email, subject: "Password Reset – Pulse Addis", message });
    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP. Try again later." });
  }
});

// ─── Verify OTP ────────────────────────────────────────────────────────────
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "User not found" });
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  if (user.passwordResetOTP !== hashedOTP || (user.passwordResetExpires && Date.now() > user.passwordResetExpires)) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }
  res.status(200).json({ message: "OTP verified. You can now reset your password." });
});

// ─── Reset Password ────────────────────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!newPassword) return res.status(400).json({ message: "New password is required" });
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, passwordResetOTP: null, passwordResetExpires: null }
  });
  res.status(200).json({ message: "Password reset successfully. You can now log in." });
});

// ─── Login ─────────────────────────────────────────────────────────────────
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }
  const findUser = await prisma.user.findUnique({ where: { email } });
  if (!findUser) {
    res.status(401);
    throw new Error("Invalid Credentials");
  }
  if (!findUser.isEmailVerified) {
    res.status(401);
    throw new Error("Please verify your email before logging in.");
  }
  if (!findUser.password || !(await bcrypt.compare(password, findUser.password))) {
    res.status(401);
    throw new Error("Invalid Credentials");
  }

  const refreshToken = await generateRefreshToken(findUser.id);
  await prisma.user.update({ where: { id: findUser.id }, data: { refreshToken } });
  res.cookie("refreshToken", refreshToken, { httpOnly: true, maxAge: 72 * 60 * 60 * 1000 });

  res.json({
    id: findUser.id,
    _id: findUser.id,
    firstname: findUser.firstname,
    lastname: findUser.lastname,
    email: findUser.email,
    mobile: findUser.mobile,
    role: findUser.role,
    token: generateToken(findUser.id),
    isEmailVerified: findUser.isEmailVerified,
  });
});

// ─── Refresh Token ─────────────────────────────────────────────────────────
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No Refresh Token in Cookies");
  const refreshToken = cookie.refreshToken;
  const user = await prisma.user.findFirst({ where: { refreshToken } });
  if (!user) throw new Error("No Refresh token in DB or not matched");
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || user.id !== decoded.id) throw new Error("Refresh token issue");
    const accessToken = generateToken(user.id);
    res.json({ accessToken });
  });
});

// ─── Logout ────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No Refresh Token in Cookies");
  const refreshToken = cookie.refreshToken;
  const user = await prisma.user.findFirst({ where: { refreshToken } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: "" } });
  }
  res.clearCookie("refreshToken", { httpOnly: true, secure: true });
  res.sendStatus(204);
});

// ─── Update User ───────────────────────────────────────────────────────────
const updatedUser = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?.id;
  const profileInfo = req.body.profileInfo || req.body;
  const data = {};
  if (profileInfo.firstname) data.firstname = profileInfo.firstname;
  if (profileInfo.lastname) data.lastname = profileInfo.lastname;
  if (profileInfo.mobile) data.mobile = profileInfo.mobile;
  if (profileInfo.address) data.address = profileInfo.address;
  if (profileInfo.profilePictures) data.profilePictures = profileInfo.profilePictures;

  const user = await prisma.user.update({ where: { id: userId }, data });
  res.status(200).json({ message: "Profile updated successfully", user });
});

// ─── Save Address ──────────────────────────────────────────────────────────
const saveAddress = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { address: req.body.address }
  });
  res.json(updatedUser);
});

// ─── Get All Users ─────────────────────────────────────────────────────────
const getallUser = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, firstname: true, lastname: true, email: true,
      mobile: true, role: true, isBlocked: true, isEmailVerified: true,
      createdAt: true, address: true
    },
    orderBy: { createdAt: "desc" }
  });
  const mapped = users.map(u => ({ ...u, _id: u.id }));
  res.json(mapped);
});

// ─── Get Single User ───────────────────────────────────────────────────────
const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, firstname: true, lastname: true, email: true,
      mobile: true, role: true, isBlocked: true, isEmailVerified: true,
      address: true, profilePictures: true, createdAt: true
    }
  });
  res.json({ getaUser: { ...user, _id: user?.id } });
});

// ─── Delete User ───────────────────────────────────────────────────────────
const deleteaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await prisma.user.delete({ where: { id } });
  res.json({ deleteaUser: deleted });
});

// ─── Block / Unblock ───────────────────────────────────────────────────────
const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const blocked = await prisma.user.update({ where: { id }, data: { isBlocked: true } });
  res.json(blocked);
});

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.update({ where: { id }, data: { isBlocked: false } });
  res.json({ message: "User UnBlocked" });
});

// ─── Delivery Boys ─────────────────────────────────────────────────────────
const getDeliveryBoys = asyncHandler(async (req, res) => {
  const deliveryBoys = await prisma.user.findMany({ where: { role: "deliveryBoy" } });
  res.status(200).json(deliveryBoys);
});

const assignOrderToDeliveryBoy = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { deliveryBoyId } = req.body;
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { assignedToId: deliveryBoyId, status: "assigned" }
  });
  res.status(200).json({ success: true, message: "Order assigned.", order });
});

const updateDeliveryBoy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.user.update({ where: { id }, data: req.body });
  res.status(200).json(updated);
});

const deleteDeliveryBoy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.status(204).json({ message: "Delivery boy deleted." });
});

// ─── Password Management ───────────────────────────────────────────────────
const updatePassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { password } = req.body;
  if (!password) return res.json({ message: "No password provided" });
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  res.json(user);
});

const forgotPasswordToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found with this email");
  const token = generateToken(user.id);
  const resetURL = `http://localhost:3001/reset-password/${token}`;
  const data = { to: email, text: "Hey User", subject: "Forgot Password Link", htm: `<a href='${resetURL}'>Click Here</a>` };
  sendEmail(data);
  res.json(token);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { token } = req.params;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(404).json({ status: "fail", message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ status: "fail", message: "Current password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.status(200).json({ status: "success", message: "Password reset successfully" });
  } catch (err) {
    res.status(400).json({ status: "fail", message: "Invalid or expired token" });
  }
});

// ─── Wishlist ──────────────────────────────────────────────────────────────
const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wishlist: true }
  });
  res.json(user);
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user?.id;
  if (!productId) return res.status(400).json({ message: "productId is required" });
  await prisma.user.update({
    where: { id: userId },
    data: { wishlist: { connect: { id: productId } } }
  });
  res.status(201).json({ message: "Product added to wishlist successfully" });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user?.id;
  await prisma.user.update({
    where: { id: userId },
    data: { wishlist: { disconnect: { id: productId } } }
  });
  res.json({ message: "Product removed from wishlist successfully" });
});

// ─── Cart (legacy – use cartController instead) ────────────────────────────
const userCart = asyncHandler(async (req, res) => {
  const { productId, color, quantity, price, selectedSize } = req.body;
  const userId = req.user?.id;
  const newCart = await prisma.cart.create({
    data: {
      userId, productId,
      selectedColor: color || "default",
      selectedSize: selectedSize || "standard",
      quantity: parseInt(quantity) || 1
    }
  });
  res.json(newCart);
});

const getUserCart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const cart = await prisma.cart.findMany({
    where: { userId },
    include: { product: true }
  });
  res.json(cart);
});

const removeProductFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { cartItemId } = req.params;
  await prisma.cart.deleteMany({ where: { id: cartItemId, userId } });
  res.json({ message: "Item removed" });
});

const emptyCart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  await prisma.cart.deleteMany({ where: { userId } });
  res.json({ message: "Cart cleared" });
});

const updateProductQuantityFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { cartItemId, newQuantity } = req.params;
  const cartItem = await prisma.cart.update({
    where: { id: cartItemId },
    data: { quantity: parseInt(newQuantity) }
  });
  res.json(cartItem);
});

// ─── Orders ────────────────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const {
    totalPrice, email, first_name, last_name, phone_number,
    address, country, city, postalCode, totalPriceAfterDiscount,
    cart, prescriptionImages, prescriptionStatus
  } = req.body;

  if (!first_name || !last_name || !phone_number || !country) {
    return res.status(400).json({ message: "Validation error: Missing required fields" });
  }

  const userId = req.user?.id;
  const items = Array.isArray(cart)
    ? cart.map(item => ({
        productId: item.productId || item._id,
        colorId: item.colorId || null,
        quantity: item.quantity || 1,
        price: item.price || 0,
        size: item.size || item.selectedSize || "standard"
      }))
    : [];

  const newOrder = await prisma.order.create({
    data: {
      userId, firstName: first_name, lastName: last_name,
      email: email || "", phone: phone_number,
      address: address || "", city: city || "",
      country: country || "Ethiopia",
      postalCode: parseInt(postalCode) || 0,
      txRef: `manual-${Date.now()}`,
      totalPrice: parseFloat(totalPrice),
      totalPriceAfterDiscount: parseFloat(totalPriceAfterDiscount || totalPrice),
      prescriptionImages: prescriptionImages || [],
      prescriptionStatus: prescriptionStatus || "not_required",
      status: "pending",
      month: new Date().getMonth() + 1,
      items: { create: items }
    }
  });
  res.status(201).json({ message: "Order created successfully", order: newOrder });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ orders });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, firstname: true, lastname: true, email: true } },
      items: { include: { product: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ orders });
});

const getsingleOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { product: true } }
    }
  });
  res.json({ orders: order });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { deliveryBoyId, status, prescriptionStatus } = req.body;
  const data = {};
  if (deliveryBoyId) { data.assignedToId = deliveryBoyId; data.status = "assigned"; }
  if (status) data.status = status;
  if (prescriptionStatus) data.prescriptionStatus = prescriptionStatus;

  const updatedOrder = await prisma.order.update({
    where: { id: req.params.id },
    data,
    include: { assignedTo: { select: { firstname: true, lastname: true, email: true } } }
  });
  res.json({ status: "success", message: "Order updated successfully", order: updatedOrder });
});

// ─── Analytics ─────────────────────────────────────────────────────────────
const getMonthWiseOrderIncome = asyncHandler(async (req, res) => {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() - 11);
  const data = await prisma.order.groupBy({
    by: ["month"],
    where: { createdAt: { lte: new Date(), gte: endDate } },
    _sum: { totalPriceAfterDiscount: true },
    _count: { id: true }
  });
  const formattedData = data.map(item => ({
    _id: { month: item.month },
    amount: item._sum.totalPriceAfterDiscount || 0,
    count: item._count.id
  }));
  res.json(formattedData);
});

const getYearlyTotalOrder = asyncHandler(async (req, res) => {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() - 11);
  const data = await prisma.order.aggregate({
    where: { createdAt: { lte: new Date(), gte: endDate } },
    _sum: { totalPriceAfterDiscount: true },
    _count: { id: true }
  });
  res.json([{ _id: null, amount: data._sum.totalPriceAfterDiscount || 0, count: data._count.id }]);
});

const getUsersByRole = asyncHandler(async (req, res) => {
  const { role } = req.query;
  if (!role) return res.status(400).json({ message: "Role query parameter is required" });
  const users = await prisma.user.findMany({ where: { role } });
  res.status(200).json({ success: true, users });
});

const getUserCount = asyncHandler(async (req, res) => {
  const [merchant, admin, deliveryBoy, user] = await Promise.all([
    prisma.user.count({ where: { role: "merchant" } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "deliveryBoy" } }),
    prisma.user.count({ where: { role: "user" } })
  ]);
  res.status(200).json({ success: true, data: { merchant, admin, deliveryBoy, user } });
});

module.exports = {
  createUser, createAppUser, verifyEmail, forgotPassword, verifyOTP,
  resetPassword, loginUserCtrl, getallUser, getaUser, deleteaUser,
  updatedUser, blockUser, unblockUser, handleRefreshToken, logout,
  updatePassword, forgotPasswordToken, getWishlist, addToWishlist,
  removeFromWishlist, saveAddress, userCart, getUserCart, createOrder,
  getMyOrders, emptyCart, getMonthWiseOrderIncome, getAllOrders, getsingleOrder,
  updateOrder, getYearlyTotalOrder, removeProductFromCart, updateProductQuantityFromCart,
  getDeliveryBoys, assignOrderToDeliveryBoy, updateDeliveryBoy, deleteDeliveryBoy,
  changePassword, getUsersByRole, getUserCount
};
