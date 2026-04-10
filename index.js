const dns = require('dns');
// Force Node.js to use IPv4 for DNS resolution instead of IPv6. 
// This fixes the "ENOTFOUND api.cloudinary.com" and "Can't reach database server" errors on Windows.
dns.setDefaultResultOrder('ipv4first');

const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

// 1. Load Environment Variables (Using Absolute Path for cPanel Compatibility)
dotenv.config({ path: path.join(__dirname, ".env") });
const PORT = process.env.PORT || 4000;
const db = require("./configure/dbClient");

// 2. CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://pulseaddis.com",
  "https://app.pulseaddis.com",
  "https://api.pulseaddis.com",
  "http://pulseaddis.com",
  "http://app.pulseaddis.com",
  "http://api.pulseaddis.com",
  "https://www.pulseaddis.com",
  "http://localhost:3002"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    credentials: true,
  }),
);

// Handle preflight requests
app.options("*", cors());

// 4. Middleware
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// 5. Import Routers
const UserRouter = require("./routes/userRoutes");
const ProductRouter = require("./routes/productRoutes");
const BrandRouter = require("./routes/brandRoutes");
const BlogRouter = require("./routes/blogRoutes");
const blogcategoryRouter = require("./routes/blogCategoryRoutes");
const ColorRouter = require("./routes/colorRoute");
const ProductCategoryRouter = require("./routes/ProductCategoryRoutes");
const ProductSubcategoryRouter = require("./routes/productSubcategoryRoutes");
const BlogSubcategoryRouter = require("./routes/BlogSubcategoryRoutes");
const tagRouter = require("./routes/tagRoutes");
const couponRouter = require("./routes/CouponRoutes");
const FqaRouter = require("./routes/FqaRoutes");
const UploadRouter = require("./routes/uploadRoute");
const NotificationRouter = require("./routes/notificationRoutes");
const PaymentRouter = require("./routes/paymentRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const deliveryRoute = require("./api/delivery/route/userRoutes");
const SizeRoute = require("./routes/sizeRoutes");
const PromotionRoute = require("./routes/promotionRoutes");
const ReportIssue = require("./routes/ReportRoute");
const StoreRoute = require("./routes/storeRoute");
const ActivityRoute = require("./routes/ActivityRoutes");
const DocumentRoute = require("./routes/documentRouter");
const RegisterRoutes = require("./routes/registerRoutes");
const MessageRouter = require("./routes/messageRoutes");
const ConversationRoute = require("./routes/conversationRoutes");
const PackageRoute = require("./routes/packageRouter");
const ChatRoutes = require("./routes/chatroutes");
const HealthAdviceRouter = require("./routes/healthAdvice");
const AdRouter = require("./routes/adRoutes");

// 3. Database Connection Check
db.pool.connect()
  .then((client) => {
    client.release();
    console.log("✅ Database connected successfully via PostgreSQL.");
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
  });

// 6. Healthy Check / Root Route (Explicit Content-Type for cPanel Recognition)
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send("👀 Pulse Addis API is LIVE! Connection established.");
});

// 7. API Routes
app.use("/api/user", UserRouter);
app.use("/api/product", ProductRouter);
app.use("/api/brand", BrandRouter);
app.use("/api/blog", BlogRouter);
app.use("/api/color", ColorRouter);
app.use("/api/category", ProductCategoryRouter);
app.use("/api/subcategory", ProductSubcategoryRouter);
app.use("/api/tag", tagRouter);
app.use("/api/upload", UploadRouter);
app.use("/api/blogcategory", blogcategoryRouter);
app.use("/api/blogSubcategory", BlogSubcategoryRouter);
app.use("/api/coupon", couponRouter);
app.use("/api/enquiry", FqaRouter);
app.use("/api/notifications", NotificationRouter);
app.use("/api/payment", PaymentRouter);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/delivery", deliveryRoute);
app.use("/api/size", SizeRoute);
app.use("/api/store", StoreRoute);
app.use("/api/promotion", PromotionRoute);
app.use("/api/report", ReportIssue);
app.use("/api/register", RegisterRoutes);
app.use("/api/activity", ActivityRoute);
app.use("/api/document", DocumentRoute);
app.use("/api/conversation", ConversationRoute);
app.use("/api/package", PackageRoute);
app.use("/api/chat", ChatRoutes);
app.use("/api/message", MessageRouter);
app.use("/api/health-advice", HealthAdviceRouter);
app.use("/api/ads", AdRouter);

// 8. Serve Static Files / React Build
const buildPath = path.join(__dirname, "build");
app.use(express.static(buildPath));

// 9. Ensuring image upload directory
const uploadDir = path.join(__dirname, "upload/images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({ storage: storage });
app.use("/images", express.static(uploadDir));

app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `${req.protocol}://${req.get("host")}/images/${req.file.filename}`,
  });
});

// 10. React Catch-all
app.get("*", (req, res) => {
  const indexPath = path.join(buildPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Build directory not found.");
  }
});

// 11. Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

// 12. Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Run 'npm run dev' again or kill the process manually.`);
    process.exit(1);
  }
  throw err;
});

// 13. Socket.io Configuration
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
});

io.on("connection", (socket) => {
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });
  socket.on("join chat", (room) => socket.join(room));
  socket.on("new message", (newMessageRec) => {
    const chat = newMessageRec.chat;
    if (!chat || !chat.users) return;
    chat.users.forEach((user) => {
      if (user !== newMessageRec.sender._id)
        socket.in(user).emit("message received", newMessageRec);
    });
  });
});

