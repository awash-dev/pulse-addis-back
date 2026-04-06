const prisma = require("../configure/prismaClient.js");
const asyncHandler = require("express-async-handler");

// Get user's cart
const getCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is missing' });
        }

        const cartItems = await prisma.cart.findMany({
            where: { userId },
            include: { product: true }
        });

        // Map to match front-end expectation if needed (product field vs productId field)
        const formattedCart = cartItems.map(item => ({
            ...item,
            productId: item.product // Ensure front-end receives product details in productId field if that's what it expects
        }));

        res.status(200).json({ cart_items: formattedCart });

    } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

// Add product to cart
const addToCart = asyncHandler(async (req, res) => {
    const { productId, selectedColor, selectedSize } = req.body;
    const userId = req.user.id;

    try {
        const existingItem = await prisma.cart.findFirst({
            where: {
                userId,
                productId,
                selectedColor,
                selectedSize
            }
        });

        if (existingItem) {
            const updatedItem = await prisma.cart.update({
                where: { id: existingItem.id },
                data: { quantity: { increment: 1 } }
            });
            return res.status(200).json(updatedItem);
        }

        const newCartItem = await prisma.cart.create({
            data: {
                userId,
                productId,
                quantity: 1,
                selectedColor,
                selectedSize,
            }
        });

        res.status(201).json(newCartItem);
    } catch (error) {
        console.error('Error adding product to cart:', error);
        res.status(500).json({ message: "Error adding product to cart" });
    }
});

// Increase cart quantity
const increaseCartQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;

    try {
        const cartItem = await prisma.cart.findFirst({
            where: { userId, productId }
        });

        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        const updatedItem = await prisma.cart.update({
            where: { id: cartItem.id },
            data: { quantity: { increment: 1 } }
        });

        res.status(200).json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: "Error increasing quantity" });
    }
});

// Decrease cart quantity
const decreaseCartQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;

    try {
        const cartItem = await prisma.cart.findFirst({
            where: { userId, productId }
        });

        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        if (cartItem.quantity > 1) {
            const updatedItem = await prisma.cart.update({
                where: { id: cartItem.id },
                data: { quantity: { decrement: 1 } }
            });
            return res.status(200).json(updatedItem);
        } else {
            await prisma.cart.delete({
                where: { id: cartItem.id }
            });
            return res.status(200).json({ message: "Product removed from cart" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error decreasing quantity" });
    }
});

// Remove product from cart
const removeFromCart = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const userId = req.user.id;

    try {
        const cartItem = await prisma.cart.findFirst({
            where: { userId, productId }
        });

        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        await prisma.cart.delete({
            where: { id: cartItem.id }
        });

        res.status(200).json({ message: "Product removed from cart" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error removing product from cart", error });
    }
});

// Get cart total quantity
const getCartTotal = asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is missing' });
    }

    try {
        const aggregate = await prisma.cart.aggregate({
            _sum: {
                quantity: true
            },
            where: { userId }
        });

        res.status(200).json({
            total_quantity: aggregate._sum.quantity || 0
        });
    } catch (error) {
        console.error("Error fetching cart total:", error);
        res.status(500).json({ message: "Error fetching cart total" });
    }
});

const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is missing' });
    }

    try {
        await prisma.cart.deleteMany({
            where: { userId }
        });

        res.status(200).json({ message: 'Cart cleared successfully' });
    } catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({ message: "Error clearing cart" });
    }
});

module.exports = {
    clearCart,
    getCart,
    addToCart,
    getCartTotal,
    increaseCartQuantity,
    decreaseCartQuantity,
    removeFromCart,
};

