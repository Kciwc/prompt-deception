const { generatePrompts } = require('./claude');
const { generateImage } = require('./dalle');
const prisma = require('../db');

/**
 * Generate a batch of prompts + images, save as GeneratedContent
 * Returns the batch ID and created records
 */
async function generateBatch(count = 5) {
  const batchId = `batch_${Date.now()}`;

  // Step 1: Generate prompts via Claude
  const prompts = await generatePrompts(count);

  // Step 2: Generate images for each prompt (sequentially to respect rate limits)
  const results = [];
  for (const { prompt, category } of prompts) {
    let imageUrl = null;
    let status = 'pending';

    try {
      imageUrl = await generateImage(prompt);
      status = 'pending'; // awaiting admin review
    } catch (err) {
      console.error(`Image generation failed for "${prompt}":`, err.message);
      status = 'pending'; // still save the prompt, admin can regenerate image
    }

    const record = await prisma.generatedContent.create({
      data: {
        prompt,
        imageUrl,
        status,
        category,
        batchId,
      },
    });

    results.push(record);
  }

  return { batchId, results };
}

/**
 * Approve a generated content item — move to RoundContent + update diversity
 */
async function approveContent(id) {
  const content = await prisma.generatedContent.findUnique({ where: { id } });
  if (!content) throw new Error('Content not found');
  if (!content.imageUrl) throw new Error('No image generated yet');

  // Create RoundContent entry
  await prisma.roundContent.create({
    data: {
      imageUrl: content.imageUrl,
      realPrompt: content.prompt,
    },
  });

  // Update status
  await prisma.generatedContent.update({
    where: { id },
    data: { status: 'approved' },
  });

  // Update diversity tracking
  if (content.category) {
    await prisma.diversityCategory.upsert({
      where: { name: content.category },
      update: { count: { increment: 1 } },
      create: { name: content.category, count: 1 },
    });
  }

  return content;
}

/**
 * Discard a generated content item — add to Bad Fence
 */
async function discardContent(id, reason) {
  const content = await prisma.generatedContent.findUnique({ where: { id } });
  if (!content) throw new Error('Content not found');

  // Update status
  await prisma.generatedContent.update({
    where: { id },
    data: { status: 'discarded', discardReason: reason },
  });

  // Add to Bad Fence so Claude avoids similar prompts
  await prisma.badFence.create({
    data: {
      prompt: content.prompt,
      reason: reason,
    },
  });

  return content;
}

/**
 * Regenerate the image for a content item (keeps the same prompt)
 */
async function regenerateImage(id) {
  const content = await prisma.generatedContent.findUnique({ where: { id } });
  if (!content) throw new Error('Content not found');

  const imageUrl = await generateImage(content.prompt);

  const updated = await prisma.generatedContent.update({
    where: { id },
    data: { imageUrl },
  });

  return updated;
}

module.exports = { generateBatch, approveContent, discardContent, regenerateImage };
