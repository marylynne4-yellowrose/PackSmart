require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

function extractJSON(text) {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Try to find raw JSON object or array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

// Analyze a single clothing item from a photo
app.post('/api/analyze-item', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData is required' });

    // Extract base64 data (strip data URI prefix if present)
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    const mediaType = base64Match ? `image/${base64Match[1]}` : 'image/jpeg';
    const base64Data = base64Match ? base64Match[2] : imageData;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `Analyze this clothing item and return a JSON object with exactly these fields:
{
  "type": "specific item name (e.g. 'white button-down shirt', 'navy chinos')",
  "category": "one of: tops, bottoms, dresses, outerwear, footwear, accessories, swimwear, activewear, sleepwear, underwear",
  "color": "primary color(s)",
  "style": ["array", "of", "style", "tags", "e.g. casual, formal, sporty"],
  "occasions": ["array of suitable occasions e.g. beach, business, evening, hiking, everyday"],
  "weatherSuitability": ["array of weather types e.g. hot, warm, mild, cool, cold, rainy"]
}
Return only valid JSON, no other text.`,
            },
          ],
        },
      ],
    });

    const rawText = message.content[0].text;
    const jsonText = extractJSON(rawText);
    const analysis = JSON.parse(jsonText);
    res.json({ analysis });
  } catch (err) {
    console.error('analyze-item error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Analyze the overall packing list against trip parameters
app.post('/api/analyze-packing', async (req, res) => {
  try {
    const { items, tripParams } = req.body;
    if (!items || !tripParams) return res.status(400).json({ error: 'items and tripParams are required' });

    const itemsText = items.map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join('\n');
    const prompt = `You are a professional travel packing consultant.

Trip details:
- Destination: ${tripParams.destination}
- Duration: ${tripParams.duration} days
- Climate: ${tripParams.climate}
- Season: ${tripParams.season}
- Interests/Activities: ${tripParams.interests.join(', ')}
- Laundromat access: ${tripParams.hasLaundromat ? 'Yes' : 'No'}
- Luggage size: ${tripParams.luggageSize}

Packed items (AI-identified):
${itemsText}

Analyze this packing list and return a JSON object with exactly these fields:
{
  "summary": "2-3 sentence overall assessment",
  "coverageScore": number from 0-100 representing how well-packed they are,
  "missing": [
    { "item": "item name", "priority": "essential|recommended|optional", "reason": "why needed" }
  ],
  "excessive": [
    { "item": "item name", "reason": "why it's too much" }
  ],
  "accessories": "brief assessment of accessories coverage",
  "tips": ["array of 3-5 practical packing tips specific to this trip"]
}
Return only valid JSON, no other text.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text;
    const jsonText = extractJSON(rawText);
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (err) {
    console.error('analyze-packing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate outfit recommendations from packed items
app.post('/api/get-outfits', async (req, res) => {
  try {
    const { items, tripParams } = req.body;
    if (!items || !tripParams) return res.status(400).json({ error: 'items and tripParams are required' });

    const itemsText = items.map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join('\n');
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const prompt = `You are a professional stylist with up-to-date knowledge of current fashion trends, helping plan outfits for a trip.

Today's date: ${currentDate}

Trip details:
- Destination: ${tripParams.destination}
- Duration: ${tripParams.duration} days
- Climate: ${tripParams.climate}
- Season: ${tripParams.season}
- Interests/Activities: ${tripParams.interests.join(', ')}
- Luggage size: ${tripParams.luggageSize}

Available clothing items (numbered):
${itemsText}

Create outfit combinations that reuse items across multiple days. For each outfit, factor in current fashion trends relevant to the specific occasion/activity and destination (e.g. what's trending right now for business travel, beach days, city sightseeing, fine dining, or nightlife) — and reflect that in the styling description (think layering choices, accessory pairings, color combinations, and silhouettes that are currently popular). Only suggest trend-driven tweaks using items the traveler already has, or as an optional accessory note. Return a JSON object with exactly these fields:
{
  "outfits": [
    {
      "name": "outfit name e.g. 'Day 1 - City Exploration'",
      "occasion": "occasion type",
      "itemIndices": [array of 1-based item numbers used in this outfit],
      "description": "brief styling description",
      "weatherBadge": "weather suitability label e.g. 'Hot & Sunny'"
    }
  ],
  "stylingTips": ["array of 3-5 styling tips for maximizing the wardrobe on this trip"]
}
Create ${Math.min(tripParams.duration, 7)} outfits covering different occasions. Return only valid JSON, no other text.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text;
    const jsonText = extractJSON(rawText);
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (err) {
    console.error('get-outfits error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PackSmart running at http://localhost:${PORT}`);
});
