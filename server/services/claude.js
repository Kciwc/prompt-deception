const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `You are a creative director for an AI-art trivia game called "Ceyon's Super Spiffy Non-Googleable Trivia."

Your job: generate image prompts that are INTERESTING, BEAUTIFUL, and NON-GOOGLEABLE.

The game works like Balderdash — players see an AI-generated image and must guess the real prompt that made it. Other players write fake prompts to trick opponents.

RULES FOR GOOD PROMPTS:
1. Prompts should produce visually stunning, memorable images
2. Prompts must be specific enough that players can't easily guess them, but not so obscure they're impossible
3. Prompts should be 10-30 words — long enough to be descriptive, short enough to be a believable guess
4. Avoid clichés, generic descriptions, or anything easily Googleable
5. Mix styles: photorealistic, painterly, surreal, sci-fi, fantasy, macro, architectural, abstract, etc.
6. Include unexpected combinations — a mundane subject in an extraordinary style, or vice versa
7. The image should be BEAUTIFUL or STRIKING to look at — this is displayed on a big TV screen at a party

CATEGORIES to vary across (aim for diversity):
- Nature & Landscapes
- Architecture & Cities
- People & Portraits
- Animals & Creatures
- Food & Still Life
- Abstract & Surreal
- Sci-Fi & Fantasy
- Historical & Cultural
- Underwater & Marine
- Space & Cosmic
- Micro/Macro Photography
- Art Styles & Movements

Return ONLY a JSON array of objects, each with "prompt" and "category" fields.
Example: [{"prompt": "A bioluminescent forest of crystal trees reflecting in mercury pools under twin moons", "category": "Sci-Fi & Fantasy"}]`;

/**
 * Generate prompts using Claude API with Bad Fence constraints
 */
async function generatePrompts(count = 5) {
  // Fetch bad fence data — prompts that were previously discarded
  const badFences = await prisma.badFence.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch diversity data — which categories are underrepresented
  const categories = await prisma.diversityCategory.findMany();
  const totalApproved = categories.reduce((sum, c) => sum + c.count, 0);

  // Build dynamic constraints
  let constraints = '';

  if (badFences.length > 0) {
    constraints += '\n\nBAD FENCE — DO NOT generate prompts like these (they were rejected for the stated reasons):\n';
    for (const fence of badFences.slice(0, 20)) {
      constraints += `- "${fence.prompt}" → Rejected because: ${fence.reason}\n`;
    }
  }

  if (categories.length > 0 && totalApproved > 0) {
    constraints += '\n\nDIVERSITY GAP — These categories need MORE content (generate prompts for underrepresented ones):\n';
    const sorted = [...categories].sort((a, b) => a.count - b.count);
    for (const cat of sorted.slice(0, 5)) {
      const pct = ((cat.count / totalApproved) * 100).toFixed(1);
      constraints += `- "${cat.name}": only ${pct}% of approved content\n`;
    }
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: BASE_SYSTEM_PROMPT + constraints,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} diverse, beautiful, non-googleable image prompts. Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  const text = message.content[0].text.trim();

  // Parse JSON — handle potential markdown code blocks
  const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
  const prompts = JSON.parse(jsonStr);

  return prompts;
}

module.exports = { generatePrompts };
