const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

// Fetch user's wishlist
const getWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user and include their wishlist products
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wishlist: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.wishlist || []);
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "An error occurred while fetching the wishlist." });
  }
});

// Add a product to the wishlist
const addToWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is missing" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        wishlist: {
          connect: { id: productId }
        }
      },
      include: {
        wishlist: true
      }
    });

    res.json(updatedUser.wishlist);
  } catch (error) {
    console.error("Error adding product to wishlist:", error);
    res.status(500).json({ message: "An error occurred while adding the product to the wishlist." });
  }
});

// Remove a product from the wishlist
const removeFromWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is missing" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        wishlist: {
          disconnect: { id: productId }
        }
      }
    });

    res.json({ message: "Product removed from wishlist successfully" });
  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ message: "An error occurred while removing the product from the wishlist." });
  }
});

// Get total number of items in the wishlist
const getWishlistTotal = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: { wishlist: true }
        }
      }
    });

    res.json({ total: user?._count.wishlist || 0 });
  } catch (error) {
    console.error("Error fetching total wishlist items:", error);
    res.status(500).json({ message: "An error occurred while fetching the total number of wishlist items." });
  }
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistTotal,
};

