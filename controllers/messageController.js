const db = require("../configure/dbClient.js");
const asyncHandler = require("express-async-handler");

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;
  const senderId = req.user?.id;
  if (!content || !chatId) {
    return res.status(400).json({ error: "Message or chatId (conversationId) missing." });
  }
  try {
    const message = await db.message.create({
      data: { conversationId: chatId, senderId, text: content },
      include: { sender: { select: { id: true, firstname: true, lastname: true } } }
    });
    // Touch conversation updatedAt
    await db.conversation.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getMessages = asyncHandler(async (req, res) => {
  const conversationId = req.params.id;
  if (!conversationId) return res.status(400).json({ error: "conversationId not found in params." });
  try {
    const messages = await db.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, firstname: true, lastname: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { sendMessage, getMessages };
