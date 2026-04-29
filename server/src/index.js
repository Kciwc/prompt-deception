const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const { registerSocketHandlers } = require('./socket');

const app = express();
app.use(cors({ origin: config.clientOrigin === '*' ? true : config.clientOrigin }));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin === '*' ? true : config.clientOrigin,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[server] listening on :${config.port} (origin=${config.clientOrigin})`);
});

const shutdown = (signal) => () => {
  console.log(`[server] ${signal} received, closing`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
