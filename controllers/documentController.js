const db = require("../configure/dbClient.js");
const cloudinary = require("../utils/cloudinary");

const createDocument = async (req, res) => {
  try {
    const { TinNumber, images, idCardImages, PostedByuserId } = req.body;
    const userId = PostedByuserId || req.user?.id;

    // Store document data as a JSON activity record linked to user
    await db.activity.create({
      data: {
        action: "Create Document",
        userId,
        details: { TinNumber, images, idCardImages, status: "pending" }
      }
    });
    await db.activity.create({
      data: {
        action: "Document Submitted",
        userId,
        details: { TinNumber, images, idCardImages, status: "pending", type: "document_record" }
      }
    });

    res.status(201).json({
      success: true,
      data: { TinNumber, images, idCardImages, status: "pending", userId }
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: "Error creating document", error: error.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    // Fetch document submissions stored as activities
    const docs = await db.activity.findMany({
      where: { action: "Document Submitted" },
      include: {
        user: { select: { id: true, firstname: true, lastname: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

const updateDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required." });

    const doc = await db.activity.update({
      where: { id },
      data: { details: { status } }
    });
    res.status(200).json({ message: "Document status updated successfully.", document: doc });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const uploadImage = async (req, res) => {
  try {
    const files = req.files;
    const uploadedImages = [];
    for (const file of files) {
      const result = await cloudinary.uploader.upload(file.path, { folder: "documents" });
      uploadedImages.push({ public_id: result.public_id, secure_url: result.secure_url });
    }
    res.status(200).json({ success: true, payload: uploadedImages });
  } catch (error) {
    res.status(400).json({ success: false, message: "Image upload failed", error: error.message });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cloudinary.uploader.destroy(id);
    if (result.result === "ok") {
      res.status(200).json({ success: true, message: "Image deleted successfully" });
    } else {
      throw new Error("Failed to delete image");
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Image deletion failed", error: error.message });
  }
};

module.exports = { createDocument, uploadImage, deleteImage, getDocuments, updateDocumentStatus };
