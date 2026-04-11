const db = require("../configure/dbClient.js");
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
    const log = await db.activity.create({
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
    const activities = await db.activity.findMany({
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
  const { role } = req.params;

  if (!role) {
    return res.status(400).json({ message: "Role parameter is required." });
  }

  try {
    // Using raw SQL to join with User table for role filtering
    const result = await db.query(
      `SELECT a.*, u.firstname, u.lastname 
       FROM "Activity" a 
       JOIN "User" u ON u.id = a."userId" 
       WHERE u.role = $1 
       ORDER BY a."createdAt" DESC`,
      [role]
    );

    const activities = result.rows.map(row => ({
      ...row,
      user: {
        firstname: row.firstname,
        lastname: row.lastname
      }
    }));

    if (!activities.length) {
      return res.status(200).json([]);
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
    const activities = await db.activity.findMany({
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
      return res.status(200).json({ activityLogs: [] });
    }

    res.status(200).json({ activityLogs: activities });
  } catch (error) {
    res.status(500).json({ message: "Error fetching activity logs" });
  }
});

// Get all activity logs
const getAllActivity = asyncHandler(async (req, res) => {
  try {
    const activities = await db.activity.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstname: true } }
      }
    });

    if (activities.length === 0) {
      return res.status(200).json({ activityLogs: [] });
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
    const activity = await db.activity.findUnique({
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

    // The current schema does not explicitly include Isread, so use details JSON if needed.
    const updatedActivity = await db.activity.update({
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
    // Use raw SQL for reliable JSONB filtering:
    // "unread" = Isread is false OR Isread key is absent (new activity)
    const result = await db.query(
      `SELECT a.*, 
              u.firstname AS "userFirstname"
       FROM "Activity" a
       LEFT JOIN "User" u ON u.id = a."userId"
       WHERE (a.details->>'Isread' IS NULL OR a.details->>'Isread' = 'false')
       ORDER BY a."createdAt" DESC`
    );

    const activities = result.rows.map((row) => ({
      ...row,
      user: row.userFirstname ? { firstname: row.userFirstname } : null,
    }));

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

