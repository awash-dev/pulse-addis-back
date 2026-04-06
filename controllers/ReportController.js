const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const createReport = asyncHandler(async (req, res) => {
  try {
    const userId = req.body.userId || req.user?.id;
    const newReport = await db.report.create({
      data: {
        userId,
        description: req.body.description || req.body.subject || "",
        status: req.body.status || "pending"
      }
    });
    await db.activity.create({
      data: { action: "create Report", userId, details: { newReport } }
    });
    res.json(newReport);
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
});

const updateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const data = {};
    if (req.body.description) data.description = req.body.description;
    if (req.body.status) data.status = req.body.status;
    const updatedReport = await db.report.update({ where: { id }, data });
    res.json(updatedReport);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.body.status) return res.status(400).json({ message: "Status is required" });
    const updatedReport = await db.report.update({
      where: { id },
      data: { status: req.body.status }
    });
    res.json(updatedReport);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const deleteReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedReport = await db.report.delete({ where: { id } });
    res.json(deletedReport);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const report = await db.report.findUnique({
      where: { id },
      include: { user: { select: { firstname: true, lastname: true, email: true } } }
    });
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllReports = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { firstname: true, lastname: true, email: true } } }
      }),
      db.report.count({ where })
    ]);
    res.json({ reports, total, page, limit });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const toggleFavoriteReport = asyncHandler(async (req, res) => {
  // Favorites are not supported by the current schema.
  res.json({ message: "Feature not available in current schema" });
});

module.exports = {
  createReport, updateReport, updateReportStatus,
  deleteReport, getReport, getAllReports, toggleFavoriteReport
};
