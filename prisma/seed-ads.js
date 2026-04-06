const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Restricted Ads (Special Offers, Popups, HomeAds)...');

  // 1. Clear ONLY the requested ad tables
  await prisma.adHome.deleteMany({});
  await prisma.specialAd.deleteMany({});
  await prisma.blog.deleteMany({ where: { isPopup: true } });

  console.log('🧹 Cleaned existing ad assets for selected tables.');

  // Clinical Imagery
  const PILLS_IMG = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800";
  const BABY_IMG = "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&q=80&w=800";
  const VIT_IMG = "https://images.unsplash.com/photo-1550572017-ed20027aa247?auto=format&fit=crop&q=80&w=800";
  const PHARMA_IMG = "https://images.unsplash.com/photo-1576091160550-2173599211d0?auto=format&fit=crop&q=80&w=1200";

  // 2. Home Main Slider (HomeAds / AdHome)
  await prisma.adHome.createMany({
    data: [
      {
        title: "Certified Clinical Assets",
        image: PHARMA_IMG,
        link: "/medicines",
      },
      {
        title: "Pediatric Care Essentials",
        image: BABY_IMG,
        link: "/mother-baby",
      },
      {
        title: "Immunity Support Network",
        image: VIT_IMG,
        link: "/vitamins",
      },
    ]
  });

  // 3. Special Ads (Special Offers Section)
  await prisma.specialAd.createMany({
    data: [
      {
        title: "24/7 Pharmacy Hot-line",
        image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1200",
        discount: 0,
        description: "Call 9102 for urgent pharmaceutical inquiries in Addis Ababa.",
        link: "/contact",
      },
      {
        title: "Rapid Clinical Delivery",
        image: "https://images.unsplash.com/photo-1616671285442-20f2632a9a4b?auto=format&fit=crop&q=80&w=1200",
        discount: 100,
        description: "Zero delivery fees for all clinical orders above 2500 ETB.",
        link: "/shop",
      },
    ]
  });

  // 4. Popup Ads (Blogs with isPopup: true)
  await prisma.blog.create({
    data: {
      title: "Pulse Addis Mobile App",
      slug: `app-launch-${Date.now()}`,
      content: "Download our app for instant pharmacist consultations.",
      description: "Available on Play Store and App Store.",
      category: "PopUp",
      subcategory: "Clinical",
      author: "System",
      isPopup: true,
      images: { secure_url: "https://images.unsplash.com/photo-1512428559083-a40ce9033afb?auto=format&fit=crop&q=80&w=800" }
    }
  });

  console.log('✅ Restricted Ad Seeding Successful!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
