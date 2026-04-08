const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { generateBatch, approveContent, discardContent, regenerateImage } = require('../services/generator');
const prisma = require('../db');

const router = express.Router();

// Generate a batch of AI content (prompts + images)
router.post('/admin/generate', adminAuth, async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 10);
    const result = await generateBatch(count);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

// Get all generated content (with optional status filter)
router.get('/admin/generated', adminAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }
    const items = await prisma.generatedContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('Fetch generated error:', err);
    res.status(500).json({ error: 'Failed to fetch generated content.' });
  }
});

// Approve generated content → moves to RoundContent
router.post('/admin/generated/:id/approve', adminAuth, async (req, res) => {
  try {
    const content = await approveContent(req.params.id);
    res.json({ success: true, content });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve.' });
  }
});

// Discard generated content → adds to Bad Fence
router.post('/admin/generated/:id/discard', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Discard reason required (min 3 chars).' });
    }
    const content = await discardContent(req.params.id, reason.trim());
    res.json({ success: true, content });
  } catch (err) {
    console.error('Discard error:', err);
    res.status(500).json({ error: err.message || 'Failed to discard.' });
  }
});

// Regenerate image for a content item (keeps same prompt)
router.post('/admin/generated/:id/regenerate', adminAuth, async (req, res) => {
  try {
    const content = await regenerateImage(req.params.id);
    res.json({ success: true, content });
  } catch (err) {
    console.error('Regenerate error:', err);
    res.status(500).json({ error: err.message || 'Failed to regenerate image.' });
  }
});

// Get diversity stats
router.get('/admin/diversity', adminAuth, async (req, res) => {
  try {
    const categories = await prisma.diversityCategory.findMany({
      orderBy: { count: 'desc' },
    });
    res.json(categories);
  } catch (err) {
    console.error('Diversity error:', err);
    res.status(500).json({ error: 'Failed to fetch diversity data.' });
  }
});

// Get bad fence entries
router.get('/admin/bad-fence', adminAuth, async (req, res) => {
  try {
    const fences = await prisma.badFence.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(fences);
  } catch (err) {
    console.error('Bad fence error:', err);
    res.status(500).json({ error: 'Failed to fetch bad fence data.' });
  }
});

module.exports = router;
