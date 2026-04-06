const db = require("../configure/dbClient.js");

const markAsRead = async (req, res) => {
  const { notificationId } = req.params;
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { read: true }
    });
    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notification as read", error: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

const clearNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    await db.notification.deleteMany({ where: { userId } });
    res.status(200).json({ message: "Notifications cleared" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear notifications", error: error.message });
  }
};

const addNotification = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const notification = await db.notification.create({
      data: {
        userId,
        message: req.body.message,
        read: false
      }
    });
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Failed to add notification", error: error.message });
  }
};

const markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications as read", error: error.message });
  }
};

module.exports = { markAsRead, getNotifications, clearNotifications, addNotification, markNotificationsAsRead };