const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require('uuid');

// Create Store
const createStore = asyncHandler(async (req, res) => {
    try {
        const { storeName, address, owner_id } = req.body;
      
        console.log("Request Body:", req.body);
  
        if (!storeName || !address || !owner_id) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newStore = await prisma.store.create({
            data: {
                storeId: req.body.storeId || uuidv4(),
                storeName,
                ownerId: owner_id,
                address
            }
        });

        // Log the activity
        await prisma.activity.create({
            data: {
                action: "Create store",
                userId: owner_id,
                details: { store: newStore }
            }
        });
  
        res.status(201).json({ message: "Store created successfully", store: newStore });
    } catch (error) {
        console.error("Error creating store:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Get Stores by User
const getStoresByUser = asyncHandler(async (req, res) => {
    const { id } = req.params; 

    try {
        if (!id) {
            return res.status(400).json({ message: "User ID is required" });
        }
        const stores = await prisma.store.findMany({
            where: { ownerId: id }
        }); 

        const mapped = stores.map(s => ({ ...s, _id: s.id }));
        res.status(200).json(mapped);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Store
const updateStore = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const updatedStore = await prisma.store.update({
            where: { id },
            data: req.body
        });

        await prisma.activity.create({
            data: {
                action: "Update store",
                userId: updatedStore.ownerId,
                details: { updatedStore: req.body }
            }
        });
        res.json({ ...updatedStore, _id: updatedStore.id });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Store not found" });
        }
        res.status(500).json({ message: error.message });
    }
});

// Delete Store
const deleteStore = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const deletedStore = await prisma.store.delete({
            where: { id }
        });

        // Log the activity
        await prisma.activity.create({
            data: {
                action: "Delete store",
                userId: deletedStore.ownerId,
                details: { deletedStore }
            }
        });

        // Delete associated products
        await prisma.product.deleteMany({
            where: { storeId: id }
        });

        res.status(200).json({
            message: "Store and associated products deleted successfully",
            deletedStore: { ...deletedStore, _id: deletedStore.id },
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Store not found" });
        }
        res.status(500).json({ message: "Failed to delete store", error: error.message });
    }
});

// Get Store by User ID (matches original logic)
const getStore = asyncHandler(async (req, res) => {
    const { id } = req.params; 
    
    try {
        const stores = await prisma.store.findMany({
            where: { ownerId: id }
        });
        
        if (!stores || stores.length === 0) {
            return res.status(404).json({ message: "Store not found" }); 
        }

        const mapped = stores.map(s => ({ ...s, _id: s.id }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message }); 
    }
});

// Get All Stores
const getallStore = asyncHandler(async (req, res) => {
    try {
        const stores = await prisma.store.findMany({ orderBy: { storeName: "asc" } });
        const mapped = stores.map(s => ({ ...s, _id: s.id }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = {
    createStore,
    updateStore,
    deleteStore,
    getStore,
    getallStore,
    getStoresByUser,
};