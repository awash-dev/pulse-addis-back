const prisma = require("../configure/prismaClient");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");

const createProduct = asyncHandler(async (req, res) => {
  try {
    const { 
      title, description, price, oldPrice, category, subcategory, 
      brand, quantity, store, strength, requiresPrescription, tags, 
      PostedByuserId, colorImagePairs, prescriptionPlans 
    } = req.body;
    
    let slug = req.body.slug;
    if (title && !slug) {
      slug = slugify(title).toLowerCase() + '-' + Math.random().toString(36).substring(2, 6);
    }
    
    // req.user is guaranteed by authMiddleware — use its UUID directly
    const postedByUserId = req.user?.id;
    if (!postedByUserId) {
      return res.status(401).json({ message: "Authentication required to create a product." });
    }

    // Identify any images provided in any variant to use as product thumbnail
    const firstPairWithImages = Array.isArray(colorImagePairs) ? colorImagePairs.find(p => p.images && p.images.length > 0) : null;
    const productImages = firstPairWithImages ? firstPairWithImages.images : [];

    const newProduct = await prisma.product.create({
      data: {
        title,
        slug,
        description: description || "",
        price: parseFloat(price) || 0,
        oldPrice: oldPrice ? parseFloat(oldPrice) : 100.0,
        category: category || "",
        subcategory: subcategory || "",
        brand: brand || "",
        quantity: parseInt(quantity) || 0,
        postedBy: { connect: { id: postedByUserId } },
        store: { connect: { id: store } },
        status: 'pending', // Always start as pending
        strength: strength || "",
        requiresPrescription: requiresPrescription === 'true' || requiresPrescription === true,
        tags: Array.isArray(tags) ? tags : [],
        prescriptionPlans: prescriptionPlans || [],
        images: productImages,
        colors: {
          create: (Array.isArray(colorImagePairs) ? colorImagePairs : [])
            .filter(p => p.color && p.images && p.images.length > 0)
            .map(p => ({
              color: { connect: { id: p.color } },
              images: p.images
            }))
        }
      },
      include: { colors: { include: { color: true } } }
    });

    await prisma.activity.create({
      data: {
        action: "create Product",
        userId: postedByUserId,
        details: JSON.stringify(newProduct)
      }
    });

    res.json({...newProduct, _id: newProduct.id});
  } catch (error) {
    console.error("Create Product Error:", error);
    res.status(400).json({ message: error.message });
  }
});

const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { 
        store: true, 
        reviews: { include: { user: true } },
        colors: { include: { color: true } }
      }
    });
    if (!product || product.status !== 'approved') {
      return res.status(404).json({ message: "Product not found or pending approval" });
    }
    res.json({ ...product, _id: product.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin version — returns any product regardless of approval status
const getAdminProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { 
        store: true, 
        reviews: { include: { user: true } },
        colors: { include: { color: true } }
      }
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ ...product, _id: product.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'approved' },
      include: { 
        store: true, 
        colors: { include: { color: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const mapped = products.map(p => ({ ...p, _id: p.id }));
    res.json(mapped);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const { 
        title, description, price, oldPrice, category, subcategory, 
        brand, quantity, store, strength, requiresPrescription, tags,
        colorImagePairs, prescriptionPlans 
    } = req.body;
    
    const updateData = {};
    if (title && title.trim()) {
        updateData.title = title;
        updateData.slug = slugify(title).toLowerCase() + '-' + id.slice(-4);
    }
    if (description !== undefined) updateData.description = description;

    if (price !== undefined && price !== "") {
        const p = parseFloat(price);
        if (!isNaN(p)) updateData.price = p;
    }
    if (oldPrice !== undefined && oldPrice !== "") {
        const op = parseFloat(oldPrice);
        if (!isNaN(op)) updateData.oldPrice = op;
    }
    if (quantity !== undefined && quantity !== "") {
        const q = parseInt(quantity);
        if (!isNaN(q)) updateData.quantity = q;
    }

    if (category) updateData.category = category;
    if (subcategory) updateData.subcategory = subcategory;
    if (brand) updateData.brand = brand;
    if (store) updateData.storeId = store;
    if (strength !== undefined) updateData.strength = strength;
    
    if (requiresPrescription !== undefined) {
        updateData.requiresPrescription = (requiresPrescription === 'true' || requiresPrescription === true);
    }
    
    if (tags) updateData.tags = Array.isArray(tags) ? tags : [];
    if (prescriptionPlans) updateData.prescriptionPlans = prescriptionPlans;

    // Logic: Non-superAdmins revert products to 'pending' on update for re-review
    if (req.user?.role !== 'superAdmin') {
      updateData.status = 'pending';
    }

    // Handle color variants update
    if (Array.isArray(colorImagePairs)) {
        // Update product images thumbnail from first variant that actually has images
        const firstPairWithImages = colorImagePairs.find(p => p.images && p.images.length > 0);
        if (firstPairWithImages) {
            updateData.images = firstPairWithImages.images;
        }

        const validPairs = colorImagePairs.filter(p => p.color && p.images && p.images.length > 0);

        // Simplest way to sync variants is delete existing and recreate
        await prisma.productColor.deleteMany({ where: { productId: id } });
        
        updateData.colors = {
            create: validPairs.map(p => ({
                color: { connect: { id: p.color } },
                images: p.images
            }))
        };
    }

    console.log("Updating Product with data:", JSON.stringify(updateData));

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { colors: { include: { color: true } } }
    });
    res.json(updatedProduct);
  } catch (error) {
    console.error("Update Product Error:", error.message, error.stack);
    res.status(400).json({ 
        message: "Product update protocol deviation", 
        error: error.message 
    });
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedProduct = await prisma.product.delete({
      where: { id }
    });
    res.json(deletedProduct);
  } catch (error) {
    throw new Error(error);
  }
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ProductApproved, rejectionReason } = req.body;
  try {
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        status: ProductApproved.toLowerCase(),
        rejectionReason: rejectionReason
      }
    });
    res.json(updatedProduct);
  } catch (error) {
    throw new Error(error);
  }
});

// Added back missing functions for routes
const getStoreProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ 
    where: { 
      storeId: req.params.id,
      status: 'approved'
    },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json(mapped);
});

const getProductCountByCategory = asyncHandler(async (req, res) => {
  const counts = await prisma.product.groupBy({
    by: ['category'],
    where: { postedByUserId: req.params.id },
    _count: { id: true }
  });
  res.json({ success: true, data: counts.map(c => ({ category: c.category, count: c._count.id })) });
});

const AllGetProductCountByCategory = asyncHandler(async (req, res) => {
  const counts = await prisma.product.groupBy({
    by: ['category'],
    _count: { id: true }
  });
  res.json({ success: true, data: counts.map(c => ({ category: c.category, count: c._count.id })) });
});

const fetchRecentProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { postedByUserId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { store: true }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const AllfetchRecentProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: 'approved' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const EachMerchantProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ 
    where: { postedByUserId: req.params.id },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const AllMerchantProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ 
    include: { store: true, colors: { include: { color: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ data: mapped });
});

const NotApprovedProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ 
    where: { status: 'pending' },
    include: { store: true, colors: { include: { color: true } } }
  });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ products: mapped, pagination: { currentPage: 1, totalPages: 1, totalCount: products.length } });
});

const RejectedProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ where: { status: 'rejected' } });
  const mapped = products.map(p => ({ ...p, _id: p.id }));
  res.json({ products: mapped, pagination: { currentPage: 1, totalPages: 1, totalCount: products.length } });
});

const addToWishlist = asyncHandler(async (req, res) => {
  res.status(501).json({ message: "Wishlist migration in progress" });
});

const rating = asyncHandler(async (req, res) => {
  res.status(501).json({ message: "Rating migration in progress" });
});

module.exports = {
  createProduct,
  getaProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getStoreProducts,
  getProductCountByCategory,
  AllGetProductCountByCategory,
  fetchRecentProducts,
  AllfetchRecentProducts,
  EachMerchantProducts,
  AllMerchantProducts,
  NotApprovedProducts,
  RejectedProducts,
  addToWishlist,
  rating,
  getAdminProduct,
};
