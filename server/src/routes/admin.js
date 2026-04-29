const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const { requireAdmin } = require('../auth/admin');
const contentLibrary = require('../db/contentLibrary');
const storage = require('../storage');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB raw — sharp recompresses to a much smaller WebP

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Wrap multer so its errors come back as proper JSON instead of a bare 500.
function uploadSingleImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'file_too_large',
        maxBytes: MAX_UPLOAD_BYTES,
      });
    }
    console.error('[admin/upload] multer error:', err);
    return res.status(400).json({ error: 'upload_rejected', detail: err.message });
  });
}

const router = express.Router();

router.get('/list', requireAdmin, (_req, res) => {
  res.json({ items: contentLibrary.list() });
});

router.post('/upload', requireAdmin, uploadSingleImage, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const realPrompt = (req.body?.realPrompt ?? '').toString().trim();
    if (realPrompt.length < 5) return res.status(400).json({ error: 'prompt_too_short' });
    if (realPrompt.length > 500) return res.status(400).json({ error: 'prompt_too_long' });

    const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`;

    const webp = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await storage.put(key, webp, 'image/webp');

    const entry = await contentLibrary.add({
      imageKey: key,
      imageUrl: storage.urlFor(key),
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
  await contentLibrary.remove(entry.id);
  try { await storage.remove(entry.imageKey); } catch (err) {
    console.warn('[admin/delete] storage.remove failed:', err.message);
  }
  res.json({ ok: true });
});

module.exports = { adminRouter: router };
