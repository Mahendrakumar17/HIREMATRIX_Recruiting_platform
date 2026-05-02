const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const buildApp = require('./src/app');
const connectDB = require('./src/config/db');
const { setupSocket } = require('./src/sockets/socket');
const seedDefaultAdmin = require('./src/utils/seedDefaultAdmin');
const { verifyTransporter } = require('./src/utils/mailer');

dotenv.config();
verifyTransporter();
connectDB().then(seedDefaultAdmin).catch((error) => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});

const { app, corsOrigin } = buildApp();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));

