const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const { requireAdmin } = require('../auth/admin');
const contentLibrary = require('../db/contentLibrary');
const storage = require('../storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

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

    const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`;

    const webp = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await storage.put(key, webp, 'image/webp');

    const entry = contentLibrary.add({
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
  contentLibrary.remove(entry.id);
  try { await storage.remove(entry.imageKey); } catch (err) {
    console.warn('[admin/delete] storage.remove failed:', err.message);
  }
  res.json({ ok: true });
});

module.exports = { adminRouter: router };
