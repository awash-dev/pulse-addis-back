const db = require('../configure/dbClient');
const asyncHandler = require("express-async-handler");

exports.assignDeliveryBoy = asyncHandler(async (req, res) => {
    try {
        const { orderId, deliveryBoyId } = req.body;
        
        const updatedOrder = await db.order.update({
            where: { id: orderId },
            data: { 
                assignedToId: deliveryBoyId,
                status: "assigned"
            }
        });

        res.status(200).json({ 
            message: 'Delivery boy assigned', 
            assignment: { ...updatedOrder, _id: updatedOrder.id } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error assigning delivery boy', error: error.message });
    }
});
