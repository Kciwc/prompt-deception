require('dotenv').config();

const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const path = require('path');

const { PORT } = require('./config');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const { setupSocketHandlers } = require('./socket/handler');

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use(healthRoutes);
app.use(adminRoutes);

// Serve built client (React SPA)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback — all routes (/, /screen, /admin) serve index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Increase default timeouts for spotty WiFi
  pingTimeout: 30000,
  pingInterval: 10000,
});

setupSocketHandlers(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
