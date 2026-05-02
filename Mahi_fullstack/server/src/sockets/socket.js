let io;

const setupSocket = (serverIo) => {
  io = serverIo;
  io.on('connection', (socket) => {
    socket.on('join', (userId) => socket.join(String(userId)));
  });
};

const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  userIds.filter(Boolean).forEach((id) => io.to(String(id)).emit(event, payload));
};

module.exports = { setupSocket, emitToUsers };

