const { generateToken } = require("../utils/createToken");
const db = require("../configure/dbClient");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, role, password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required for registration." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.user.create({
      data: {
        firstname: firstName,
        lastname: lastName,
        email: email.toLowerCase().trim(),
        role: role || "user",
        password: hashedPassword,
        isEmailVerified: false,
      },
    });

    // Log Activity
    await db.activity.create({
      data: {
        action: "admin-register-user",
        userId: newUser.id,
        details: JSON.stringify({ email: newUser.email, role: newUser.role })
      }
    });

    res.status(201).json({ 
      message: "User registered successfully.", 
      user: { ...newUser, _id: newUser.id } 
    });
  } catch (error) {
    res.status(500).json({ error: "Error registering user.", detail: error.message });
  }
});

module.exports = {
    registerUser
};