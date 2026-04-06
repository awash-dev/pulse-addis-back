const db = require("../configure/dbClient.js");

const getAssignedOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    const assignments = await db.deliveryAssignment.findMany({
      where: { userId },
      include: {
        order: {
          include: {
            user: { select: { firstname: true, lastname: true, email: true } },
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ orders: assignments });
  } catch (error) {
    res.status(500).json({ message: "Error fetching assigned orders", error: error.message });
  }
};

const markOrderDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await db.deliveryAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.userId !== (req.user?.id)) {
      return res.status(403).json({ message: "Not authorized to update this order" });
    }
    const updated = await db.deliveryAssignment.update({
      where: { id },
      data: { status: "delivered" }
    });
    await db.order.update({ where: { id: assignment.orderId }, data: { status: "delivered" } });
    res.status(200).json({ message: "Order marked as delivered", assignment: updated });
  } catch (error) {
    res.status(500).json({ message: "Error marking order as delivered", error: error.message });
  }
};

module.exports = { getAssignedOrders, markOrderDelivered };