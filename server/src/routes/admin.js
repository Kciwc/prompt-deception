const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const { requireAdmin } = require('../auth/admin');
const contentLibrary = require('../db/contentLibrary');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Memory storage — sharp streams the buffer to a WebP file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB raw
});

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

const router = express.Router();

router.get('/list', requireAdmin, (_req, res) => {
  res.json({ items: contentLibrary.list() });
});

router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const realPrompt = (req.body?.realPrompt ?? '').toString().trim();
    if (realPrompt.length < 5) return res.status(400).json({ error: 'prompt_too_short' });
    if (realPrompt.length > 500) return res.status(400).json({ error: 'prompt_too_long' });

    await ensureUploadsDir();
    const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`;
    const dest = path.join(UPLOADS_DIR, key);

    // Resize to max 1280px wide and re-encode as WebP for size.
    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(dest);

    const entry = contentLibrary.add({
      imageKey: key,
      imageUrl: `/uploads/${key}`,
      realPrompt,
    });

    res.json({ ok: true, item: entry });
  } catch (err) {
    console.error('[admin/upload]', err);
    res.status(500).json({ error: 'upload_failed' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const all = contentLibrary.list();
  const entry = all.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  contentLibrary.remove(entry.id);
  // Best-effort delete of file from disk.
  try { await fs.unlink(path.join(UPLOADS_DIR, entry.imageKey)); } catch (_) {}
  res.json({ ok: true });
});

module.exports = { adminRouter: router, UPLOADS_DIR };
