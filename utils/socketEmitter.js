/**
 * Socket.io emitter helper.
 *
 * The io instance is attached to app by backend/index.js after the HTTP
 * server is created. Controllers import this helper and call emitToRoom
 * without needing a direct reference to the io object.
 */

let io = null;

const setIo = (ioInstance) => {
  io = ioInstance;
};

const getIo = () => io;

const emitToRoom = (room, event, payload) => {
  if (!io) {
    console.warn(`Socket.io not initialized; skipping emit ${event} to ${room}`);
    return;
  }
  io.to(room).emit(event, payload);
};

const emitToUser = (userId, event, payload) => {
  emitToRoom(`user:${userId}`, event, payload);
};

const emitToAdmins = (event, payload) => {
  emitToRoom("admin", event, payload);
};

const emitToB2bBuyers = (event, payload) => {
  emitToRoom("b2b:buyers", event, payload);
};

module.exports = {
  setIo,
  getIo,
  emitToRoom,
  emitToUser,
  emitToAdmins,
  emitToB2bBuyers,
};
