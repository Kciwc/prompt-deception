require('dotenv').config();

const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const path = require('path');

const { PORT } = require('./config');

const app = express();
app.use(cors());
app.use(express.json());

// Health check — registered first so nothing can block it
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
const adminRoutes = require('./routes/admin');
const generateRoutes = require('./routes/generate');
app.use(adminRoutes);
app.use(generateRoutes);

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
  pingTimeout: 30000,
  pingInterval: 10000,
});

const { setupSocketHandlers } = require('./socket/handler');
setupSocketHandlers(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
