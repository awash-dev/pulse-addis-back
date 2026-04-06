const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting "Perfect" Pulse Addis Seeding...');
  
  // Clear existing data safely
  console.log('Cleaning existing clinical records...');
  // Delete in order to avoid FK constraints if any (Products have colors, etc.)
  await prisma.productColor.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.blog.deleteMany({});
  await prisma.blogCategory.deleteMany({});
  await prisma.blogSubCategory.deleteMany({});
  await prisma.adHome.deleteMany({});
  await prisma.specialAd.deleteMany({});
  await prisma.bannerAd.deleteMany({});

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('Pulse@Admin123', salt);

  // 1. Core Users
  const admin = await prisma.user.create({
    data: {
      firstname: 'Abebe', lastname: 'Bekele', email: 'admin@pulseaddis.com',
      mobile: '0911223344', password: password, role: 'superAdmin',
      isEmailVerified: true,
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      firstname: 'Dawit', lastname: 'Getachew', email: 'admin2@pulseaddis.com',
      mobile: '0911223345', password: password, role: 'admin',
      isEmailVerified: true,
    },
  });

  const merchant = await prisma.user.create({
    data: {
      firstname: 'Bethlehem', lastname: 'Tadesse', email: 'merchant@pulse.et',
      mobile: '0922334455', password: password, role: 'merchant',
      isEmailVerified: true,
    },
  });

  const deliveryBoy = await prisma.user.create({
    data: {
      firstname: 'Kebede', lastname: 'Alemu', email: 'delivery@pulse.et',
      mobile: '0933445566', password: password, role: 'deliveryBoy',
      isEmailVerified: true,
    },
  });

  const normalUser = await prisma.user.create({
    data: {
      firstname: 'Yosef', lastname: 'Tesfaye', email: 'user@pulse.et',
      mobile: '0944556677', password: password, role: 'user',
      isEmailVerified: true,
    },
  });

  // Write out users.txt with login credentials
  const fs = require('fs');
  const userListText = `=== PULSE ADDIS TEST USERS ===
Here are the seeded test accounts for easy login:

1. Super Admin
   Email: admin@pulseaddis.com
   Password: Pulse@Admin123

2. Admin
   Email: admin2@pulseaddis.com
   Password: Pulse@Admin123

3. Merchant
   Email: merchant@pulse.et
   Password: Pulse@Admin123

4. Delivery Boy
   Email: delivery@pulse.et
   Password: Pulse@Admin123

5. Normal User
   Email: user@pulse.et
   Password: Pulse@Admin123
`;
  fs.writeFileSync('users.txt', userListText);
  console.log('✅ users.txt generated with credentials');

  // 2. Pharmacy Store
  const store = await prisma.store.create({
    data: {
      storeId: 'ST-AD-001',
      storeName: 'Pulse Pharmacy Bole',
      ownerId: merchant.id,
      address: 'Bole Road, Near Friendship Mall, Addis Ababa',
    },
  });

  // 3. Perfect Product Catalog (Medicine/Pharma Focused)
  // Reliable Unsplash IDs for Medicines
  const PHARMA_IMG = "https://images.unsplash.com/photo-1576091160550-2173599211d0?auto=format&fit=crop&q=80&w=1200"; // Clinic
  const PILLS_IMG = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800"; // Pills
  const VIT_IMG = "https://images.unsplash.com/photo-1550572017-ed20027aa247?auto=format&fit=crop&q=80&w=800"; // Vitamin
  const BABY_IMG = "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&q=80&w=800"; // Baby
  const EQUIP_IMG = "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=800"; // Monitor

  // 3. Categories & Subcategories (Essential for dropdowns)
  console.log('Seeding Category Metadata...');
  const catNames = ["Medicines", "Medical Equipment", "Mother & Baby", "Vitamins & Supplements"];
  for (const name of catNames) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  const subcatNames = ["Pain Relief", "Cough & Cold", "Stomach Care", "Diabetic Care", "Essentials", "Immunity"];
  for (const name of subcatNames) {
    await prisma.subcategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const medicines = [
    {
      title: "Paracetamol (EPHARM) 500mg",
      slug: "paracetamol-epharm-500",
      description: "Standard local analgesic. Best for headaches and fever.",
      price: 25.0, category: "Medicines", subcategory: "Pain Relief",
      brand: "EPHARM", tags: ["trending", "popular"], images: [{ secure_url: PILLS_IMG }]
    },
    {
      title: "Paingo Extra (Caffeine + Para)",
      slug: "paingo-extra-enhanced",
      description: "Enhanced pain relief for migraines and severe tension headaches.",
      price: 85.0, category: "Medicines", subcategory: "Pain Relief",
      brand: "EPHARM", tags: ["popular"], images: [{ secure_url: PILLS_IMG }]
    },
    {
      title: "Flustop Multi-Symptom",
      slug: "flustop-clinical",
      description: "Comprehensive relief for flu, cold, and respiratory congestion.",
      price: 130.0, category: "Medicines", subcategory: "Cough & Cold",
      brand: "EPHARM", tags: ["flash sale", "trending"], images: [{ secure_url: PHARMA_IMG }]
    },
    {
      title: "Healer (Omeprazole 20mg)",
      slug: "healer-omeprazole-20",
      description: "Effective acid suppressor for gastritis and GERD symptoms.",
      price: 15.0, category: "Medicines", subcategory: "Stomach Care",
      brand: "Pulse Pharma", tags: ["popular", "essential"], images: [{ secure_url: PILLS_IMG }]
    },
    {
      title: "Accu-Chek Instant Kit",
      slug: "accu-chek-instant-kit",
      description: "Complete blood glucose monitoring kit for diabetic patients.",
      price: 3200.0, category: "Medical Equipment", subcategory: "Diabetic Care",
      brand: "Roche", tags: ["vip", "essential"], images: [{ secure_url: EQUIP_IMG }]
    },
    {
      title: "Pampers Baby-Dry S3 (60ct)",
      slug: "pampers-baby-dry-s3",
      description: "High-absorbency diapers with breathable layers for overnight protection.",
      price: 1850.0, category: "Mother & Baby", subcategory: "Essentials",
      brand: "Pampers", tags: ["popular"], images: [{ secure_url: BABY_IMG }]
    },
    {
       title: "Nature's Bounty Vitamin C 1000mg",
       slug: "vit-c-1000mg-nb",
       description: "Immune support supplement with Rose Hips for enhanced absorption.",
       price: 950.0, category: "Vitamins & Supplements", subcategory: "Immunity",
       brand: "Nature's Bounty", tags: ["trending"], images: [{ secure_url: VIT_IMG }]
    }
  ];

  for (const info of medicines) {
    const product = await prisma.product.create({
      data: {
        title: info.title,
        slug: info.slug,
        description: info.description,
        price: info.price,
        oldPrice: info.price * 1.15,
        category: info.category,
        subcategory: info.subcategory,
        brand: info.brand,
        quantity: 500,
        postedByUserId: merchant.id,
        storeId: store.id,
        status: 'approved',
        tags: info.tags,
        images: info.images,
        discount: 15,
      }
    });

    // Color linkage for frontend nested image logic
    const color = await prisma.color.upsert({
        where: { id: "p-color-main" },
        update: {},
        create: { id: "p-color-main", name: "Standard", code: "#FFFFFF" }
    });

    await prisma.productColor.create({
      data: {
        productId: product.id,
        colorId: color.id,
        images: info.images
      }
    });
  }

  // 4. Proper Advertising & Banners (Database Driven)
  console.log('Seeding Real Advertising Assets to dedicated tables...');

  // Home Main Slider
  await prisma.adHome.createMany({
    data: [
      {
        title: "Clinical Pain Relief Solutions",
        image: PILLS_IMG,
        link: "/medicines",
      },
      {
        title: "Modern Diabetic Monitoring",
        image: EQUIP_IMG,
        link: "/medical-equipment",
      },
      {
        title: "Advanced Pediatric Care",
        image: BABY_IMG,
        link: "/mother-baby",
      },
    ]
  });

  // Special Ads (Special Offers Section)
  await prisma.specialAd.createMany({
    data: [
      {
        title: "Immunity Boosters Month",
        image: VIT_IMG,
        discount: 25,
        description: "Save 25% on all vitamins and supplements this month.",
        link: "/vitamins",
      },
      {
        title: "Bole Area Free Delivery",
        image: "https://images.unsplash.com/photo-1616671285442-20f2632a9a4b?auto=format&fit=crop&q=80&w=1200",
        discount: 100,
        description: "Zero delivery fee for orders above 2000 ETB in Bole area.",
        link: "/shop",
      },
    ]
  });

  // Banner Ads (Thin strips)
  await prisma.bannerAd.createMany({
    data: [
      {
        title: "Licensed Pharmaceutical Network",
        image: PHARMA_IMG,
        position: "top",
        link: "/about",
      },
    ]
  });

  // 5. PopUp Ads & Blog Categories
  console.log('Seeding Blog Metadata...');
  const blogCats = ["PopUp", "Health Advice", "Pharmacy News", "Clinic Updates"];
  for (const name of blogCats) {
    await prisma.blogCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const blogSubCats = ["General", "Urgent", "Membership", "Clinical"];
  for (const name of blogSubCats) {
    await prisma.blogSubCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log('Seeding PopUp Assets...');
  await prisma.blog.create({
    data: {
      title: "Join Pulse Membership",
      slug: "popup-membership-2026",
      content: "Exclusive clinical updates and priority delivery for members.",
      description: "Subscribe now to save 10% on your first order and get free pharmacist consultation.",
      category: "PopUp",
      subcategory: "Membership",
      author: "System",
      isPopup: true,
      images: { secure_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800" }
    }
  });

  // 6. Practical Blogs
  await prisma.blog.create({
    data: {
      title: "Managing Seasonal Flu in Addis",
      slug: "flu-management-guide",
      content: "Detailed steps to mitigate flu symptoms using local remedies and clinical assets...",
      category: "Health Advice",
      author: "Dr. Birhanu",
      images: { secure_url: "https://images.unsplash.com/photo-1471864190281-ad5fe9afef72?auto=format&fit=crop&q=80&w=800" }
    }
  });

  console.log('✅ "Perfect" Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
