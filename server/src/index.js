const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const config = require('./config');
const { registerSocketHandlers } = require('./socket');
const { adminRouter } = require('./routes/admin');
const storage = require('./storage');
const contentLibrary = require('./db/contentLibrary');
const branding = require('./db/branding');

const app = express();
app.use(cors({ origin: config.clientOrigin === '*' ? true : config.clientOrigin }));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  storage: storage.kind,
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown').slice(0, 7),
  deployedAt: process.env.RAILWAY_DEPLOYMENT_CREATED_AT || null,
}));

// Public branding info — read-only, no auth. Returns just the URL fields
// the client UI needs. The TV uses this to render the header portrait.
app.get('/api/branding', (_req, res) => {
  const p = branding.getPortrait();
  res.json({
    portrait: p ? { imageUrl: p.imageUrl, uploadedAt: p.uploadedAt } : null,
  });
});

if (storage.kind === 'local') {
  app.use('/uploads', express.static(storage.uploadsDir, { maxAge: '7d' }));
}
app.use('/admin', adminRouter);

// Serve the built client app from the same origin (Railway hosts both).
// In local dev the client runs on its own Vite server, so client/dist may
// not exist — guard with a file check.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const CLIENT_INDEX = path.join(CLIENT_DIST, 'index.html');
const clientBuilt = fs.existsSync(CLIENT_INDEX);

if (clientBuilt) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1d', index: false }));
  // SPA fallback for React Router. Last middleware — only catches GETs
  // that asked for HTML and didn't match anything above.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const accepts = req.headers.accept ?? '';
    if (!accepts.includes('text/html')) return next();
    res.sendFile(CLIENT_INDEX);
  });
  console.log('[server] serving client from', CLIENT_DIST);
} else {
  console.log('[server] client/dist not found — client served separately (dev mode)');
}

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

// Hydrate content library from the persistent manifest. Doesn't block
// the listen call — admin requests will hit the empty library briefly
// during startup if a deploy lands during a request, which is fine.
contentLibrary.init().catch((err) => {
  console.error('[server] contentLibrary.init failed:', err);
});
branding.init().catch((err) => {
  console.error('[server] branding.init failed:', err);
});

const shutdown = (signal) => () => {
  console.log(`[server] ${signal} received, closing`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
