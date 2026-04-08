const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const prisma = require('../db');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config — store in memory, then sharp converts to WebP
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  },
});

// Upload image + real prompt
router.post('/admin/upload', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }

    const { realPrompt } = req.body;
    if (!realPrompt || realPrompt.trim().length < 5) {
      return res.status(400).json({ error: 'Real prompt must be at least 5 characters.' });
    }

    // Convert to WebP with sharp
    const filename = `round_${Date.now()}.webp`;
    const filepath = path.join(uploadsDir, filename);

    await sharp(req.file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    // Save to database
    const round = await prisma.roundContent.create({
      data: {
        imageUrl: `/uploads/${filename}`,
        realPrompt: realPrompt.trim(),
      },
    });

    res.json({ success: true, round });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload.' });
  }
});

// Get all round content
router.get('/admin/rounds', adminAuth, async (req, res) => {
  try {
    const rounds = await prisma.roundContent.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error('Fetch rounds error:', err);
    res.status(500).json({ error: 'Failed to fetch rounds.' });
  }
});

// Delete a round
router.delete('/admin/rounds/:id', adminAuth, async (req, res) => {
  try {
    const round = await prisma.roundContent.delete({
      where: { id: req.params.id },
    });

    // Delete the image file
    const filepath = path.join(__dirname, '..', round.imageUrl);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete round error:', err);
    res.status(500).json({ error: 'Failed to delete round.' });
  }
});

// Reset used status for all rounds
router.post('/admin/rounds/reset', adminAuth, async (req, res) => {
  try {
    await prisma.roundContent.updateMany({
      data: { used: false },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Reset rounds error:', err);
    res.status(500).json({ error: 'Failed to reset rounds.' });
  }
});

// Get hall of fame
router.get('/admin/hall-of-fame', adminAuth, async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      include: { hallOfFame: true },
      orderBy: { endedAt: 'desc' },
      take: 20,
    });
    res.json(games);
  } catch (err) {
    console.error('Hall of fame error:', err);
    res.status(500).json({ error: 'Failed to fetch hall of fame.' });
  }
});

module.exports = router;
