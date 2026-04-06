const db = require("../configure/dbClient.js");

const getConversations = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const conversations = await db.conversation.findMany({
      where: { users: { some: { id: userId } } },
      include: {
        users: { select: { id: true, firstname: true, lastname: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });

    const conversationUserData = conversations.map(convo => {
      const otherUser = convo.users.find(u => u.id !== userId);
      const lastMessage = convo.messages[0] || null;
      return {
        user: {
          receiverId: otherUser?.id,
          email: otherUser?.email,
          fullName: otherUser ? `${otherUser.firstname} ${otherUser.lastname}` : "Unknown"
        },
        conversationId: convo.id,
        lastMessage: lastMessage?.text || ""
      };
    });

    res.status(200).json(conversationUserData);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getConversations };
