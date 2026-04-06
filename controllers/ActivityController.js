const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

// Function to log activity
const logActivity = async (
  userId,
  action,
  resource,
  resourceId,
  details = {},
) => {
  try {
    const log = await prisma.activity.create({
      data: {
        userId,
        action,
        details: {
            resource,
            resourceId,
            ...details
        },
      }
    });
    console.log("Activity logged successfully");
    return log;
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

const getallAdminActivity = asyncHandler(async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
        include: {
            user: {
                select: {
                    firstname: true,
                    lastname: true,
                    role: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getAllActivityByRole = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;

    if (!role) {
      return res.status(400).json({ message: "Role parameter is required." });
    }

    const activities = await prisma.activity.findMany({
        where: {
            user: { role: role }
        },
        include: {
            user: {
                select: {
                    firstname: true,
                    lastname: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!activities.length) {
      return res.status(404).json({ message: `No activities found for role: ${role}` });
    }

    res.json(activities);
  } catch (error) {
    res.status(500).json({
      message: `Error fetching activities for role ${role}: ${error.message}`,
    });
  }
});

// Get all activity logs for a user
const getAdminActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const activities = await prisma.activity.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
            select: { firstname: true }
        }
      }
    });

    if (!activities.length) {
      return res.status(404).json({ message: "No activity found for this user" });
    }

    res.status(200).json({ activityLogs: activities });
  } catch (error) {
    res.status(500).json({ message: "Error fetching activity logs" });
  }
});

// Get all activity logs
const getAllActivity = asyncHandler(async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstname: true } }
      }
    });

    if (activities.length === 0) {
      return res.status(404).json({ message: "No activity found" });
    }

    res.status(200).json({ activityLogs: activities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching activity logs", error: error.message });
  }
});

const getEachActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        user: { select: { firstname: true } }
      }
    });

    if (!activity) {
      return res.status(404).json({ message: "No activity found" });
    }

    res.status(200).json({ activityLogs: [activity] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching activity log" });
  }
});

const updateActivityLog = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { Isread } = req.body;

    if (typeof Isread !== "boolean") {
      return res.status(400).json({ message: "Invalid value for Isread. It must be a boolean." });
    }

    // Since our Prisma schema doesn't have Isread, we might need to add it or store it in details
    // But for now, let's assume we can update it if it exists in the model.
    // If not in model, we can store in Json 'details'
    const updatedActivity = await prisma.activity.update({
      where: { id },
      data: {
        details: {
            // Merge existing details with new Isread status
            Isread: Isread
        }
      },
    });

    res.status(200).json({
        message: "Activity updated successfully.",
        data: updatedActivity,
      });
  } catch (error) {
    console.error("Error updating activity log:", error.message);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
});

// Get all unread activity logs
const getUnreadActivity = asyncHandler(async (req, res) => {
  try {
    // This is tricky without a dedicated column, but we'll try to filter by Json
    // In PostgreSQL, you can query Jsonb fields.
    const activities = await prisma.activity.findMany({
      where: {
        details: {
          path: ['Isread'],
          equals: false
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstname: true } }
      }
    });

    if (activities.length === 0) {
      return res.status(202).json({ message: "No unread activity found" });
    }

    res.status(200).json({ activityLogs: activities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching activity logs", error: error.message });
  }
});

module.exports = {
  logActivity,
  getAllActivityByRole,
  getEachActivity,
  getAdminActivity,
  getallAdminActivity,
  getAllActivity,
  updateActivityLog,
  getUnreadActivity,
};

