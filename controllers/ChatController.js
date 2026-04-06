const prisma = require("../configure/prismaClient.js");

// Map Conversation model to Chat-like API for frontend compatibility
const accessChat = async (req, res) => {
  const { userId } = req.body;
  const myId = req.user?.id || req.user?._id;

  if (!userId) {
    return res.status(400).json({ error: "userId not present in the request body." });
  }

  try {
    // Find existing conversation with exactly these 2 users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { users: { some: { id: myId } } },
          { users: { some: { id: userId } } }
        ]
      },
      include: {
        users: { select: { id: true, firstname: true, lastname: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    if (existing) return res.status(200).json(existing);

    const newConvo = await prisma.conversation.create({
      data: {
        users: { connect: [{ id: myId }, { id: userId }] }
      },
      include: {
        users: { select: { id: true, firstname: true, lastname: true, email: true } }
      }
    });

    res.status(201).json(newConvo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getChats = async (req, res) => {
  const myId = req.user?.id || req.user?._id;
  try {
    const convos = await prisma.conversation.findMany({
      where: { users: { some: { id: myId } } },
      include: {
        users: { select: { id: true, firstname: true, lastname: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });
    if (convos.length === 0) return res.status(200).json([]);
    res.status(200).json(convos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Group chats not fully supported – stub implementations
const createGroupChat = async (req, res) => {
  res.status(200).json({ message: "Group chats managed via Conversations" });
};
const renameGroup = async (req, res) => {
  res.status(200).json({ message: "Not supported" });
};
const removeFromGroup = async (req, res) => {
  res.status(200).json({ message: "Not supported" });
};
const addToGroup = async (req, res) => {
  res.status(200).json({ message: "Not supported" });
};

module.exports = { accessChat, getChats, createGroupChat, renameGroup, removeFromGroup, addToGroup };