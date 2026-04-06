# RiseTech API Backend (Pulse Addis)

A powerful and scalable Node.js/Express.js backend for the RiseTech & Pulse Addis E-commerce ecosystem. This API manages users, products, orders, payments, real-time messaging, and more.

## 🚀 Features

- **Robust Authentication**: Secure user management with JWT and Passport.
- **Product Management**: Complete CRUD for Products, Categories, Subcategories, Brands, Colors, and Tags.
- **Order & Cart Lifecycle**: Efficiently manage user carts, wishlists, and order processing.
- **Real-time Communication**: Integrated Socket.io for live chats, conversations, and notifications.
- **Secure Payments**: Integrated with **Chapa** payment gateway for Ethiopian transactions.
- **Media Management**: Automated file uploads using **Multer** and remote storage with **Cloudinary**.
- **Email Notifications**: Automated system emails using **Nodemailer**.
- **Admin Dashboard Integration**: Specialized routes for administrative actions and reporting.

## 🛠️ Technology Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Real-time**: [Socket.io](https://socket.io/)
- **Authentication**: JWT (JSON Web Tokens)
- **External Services**: Cloudinary (Images), Chapa (Payments), Gmail SMTP (Email)

## 📁 Project Structure

```text
backend/
├── api/            # Specialized API sub-modules (Delivery, etc.)
├── configure/      # Database configuration
├── controllers/    # Business logic for each route
├── models/         # Mongoose schemas and models
├── routes/         # Express router definitions
├── middlewares/    # Custom middlewares (Auth, Error handling)
├── utils/          # Helper functions and utilities
├── upload/         # Local temporary file storage
└── index.js        # Main entry point
```

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js installed locally
- MongoDB database (local or Atlas)

### 2. Installation
```bash
git clone https://github.com/awash-dev/backends-pulse-addis.git
cd backends-pulse-addis
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory and configure the following:

```env
PORT=4000
MONGO_DB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Chapa Payment Config
CHAPA_SECRET_KEY=your_chapa_secret
CHAPA_PUBLIC_KEY=your_chapa_public

# Email Config
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 4. Running the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

## 🔌 API Endpoints (Quick Reference)

| Path | Summary |
| :--- | :--- |
| `/api/user` | Auth & User Profiles |
| `/api/product` | Product Inventory |
| `/api/category` | Product Categories |
| `/api/payment` | Chapa Integration |
| `/api/chat` | Messaging Logic |
| `/api/upload` | File Uploads |

---
© 2026 RiseTech ET. All rights reserved.
