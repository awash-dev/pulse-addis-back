const prisma = require("../../../configure/prismaClient");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

// Create User (Legacy compatibility)
const createUser = asyncHandler(async (req, res) => {
  const { firstname, lastname, username, email, password, mobile, role } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return res.status(400).json({ message: "User already exists." });

  // Use the same hashing logic as userController if possible, but keeping it simple for now
  // Note: Better to use the main userController.js for this.
  const newUser = await prisma.user.create({
    data: {
      firstname,
      lastname,
      email,
      password: await bcrypt.hash(password, 10),
      mobile: mobile || "0000000000",
      role: role || "deliveryBoy",
    },
  });

  res.status(201).json({ success: true, message: "User created successfully.", userId: newUser.id });
});

// Get All Delivery Boys
const getDeliveryBoys = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const deliveryBoys = await prisma.user.findMany({ 
    where: { role: "deliveryBoy" },
    orderBy: { createdAt: 'desc' }
  });
  // Map id to _id for frontend
  res.status(200).json(deliveryBoys.map(u => ({ ...u, _id: u.id })));
});

// Get Assigned Orders
const getAssignedOrders = asyncHandler(async (req, res) => {
  const { deliveryPersonId } = req.params;
  const orders = await prisma.order.findMany({
    where: { assignedToId: deliveryPersonId },
    include: { items: { include: { product: true } } }
  });
  res.status(200).json(orders.map(o => ({ ...o, _id: o.id })));
});

// Update Delivery Boy
const updateDeliveryBoy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.user.update({
    where: { id },
    data: req.body,
  });
  res.status(200).json({ ...updated, _id: updated.id });
});

// Delete Delivery Boy
const deleteDeliveryBoy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.status(204).json({ message: "Delivery boy deleted successfully." });
});

// Update Order Status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: status }
  });

  res.status(200).json({ message: "Order status updated successfully", order: { ...updatedOrder, _id: updatedOrder.id } });
});

// Get Delivery Boy By ID
const getDeliveryBoyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deliveryBoy = await prisma.user.findFirst({
    where: { id, role: "deliveryBoy" }
  });

  if (!deliveryBoy) {
    return res.status(404).json({ message: "Delivery boy not found." });
  }

  res.status(200).json({ ...deliveryBoy, _id: deliveryBoy.id });
});

// Activate User
const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: true }
  });
  res.status(200).json({ message: "User activated successfully", user: { ...user, _id: user.id } });
});

// Deactivate Delivery Person
const deactivateDeliveryPerson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false }
  });
  res.status(200).json({ message: "Delivery person deactivated successfully", user: { ...user, _id: user.id } });
});

module.exports = {
  createUser,
  getDeliveryBoys,
  getAssignedOrders,
  updateDeliveryBoy,
  deleteDeliveryBoy,
  updateOrderStatus,
  getDeliveryBoyById,
  activateUser,
  deactivateDeliveryPerson
};
