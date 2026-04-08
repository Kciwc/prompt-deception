const OpenAI = require('openai');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Generate an image using DALL-E 3, download it, convert to WebP
 * Returns the local /uploads/... URL path
 */
async function generateImage(prompt) {
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1792x1024', // Widescreen for TV display
    quality: 'hd',
    style: 'vivid',
  });

  const imageUrl = response.data[0].url;

  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // Convert to WebP with sharp
  const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const filepath = path.join(uploadsDir, filename);

  await sharp(imageBuffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(filepath);

  return `/uploads/${filename}`;
}

module.exports = { generateImage };
