require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FEEDBACK_FILE = path.join(__dirname, 'feedback_data.csv');
const FEEDBACK_KEY = process.env.FEEDBACK_KEY || 'packsmart-feedback-2026';

// Initialize CSV with headers if it doesn't exist
if (!fs.existsSync(FEEDBACK_FILE)) {
  fs.writeFileSync(FEEDBACK_FILE, 'Date Submitted,Question,Rating,Comments\n', 'utf8');
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

function extractJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

// Analyze a single clothing item from a photo
app.post('/api/analyze-item', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData is required' });

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

// Generate packing guide with climate analysis
app.post('/api/packing-guide', async (req, res) => {
  try {
    const { tripParams, travelers } = req.body;
    if (!tripParams || !travelers) return res.status(400).json({ error: 'tripParams and travelers are required' });

    const travelerDescriptions = travelers.map(t =>
      t.isPet
        ? `- ${t.label}: pet, luggage: ${t.luggageSize}`
        : `- ${t.label}: gender: ${t.gender}, luggage: ${t.luggageSize}`
    ).join('\n');

    const isMultiLocation = tripParams.multiLocation && Array.isArray(tripParams.locations);
    const activeLocations = isMultiLocation
      ? tripParams.locations.filter(l => l.destination && l.startDate && l.endDate)
      : null;

    const locationContext = isMultiLocation && activeLocations.length > 1
      ? `This is a multi-location trip with ${activeLocations.length} stops:\n${activeLocations.map((l, i) => `  Stop ${i + 1}: ${l.destination} (${l.startDate} to ${l.endDate})`).join('\n')}`
      : `- Destination: ${tripParams.destination}
- Duration: ${tripParams.duration} days
${tripParams.startDate && tripParams.endDate ? `- Travel dates: ${tripParams.startDate} to ${tripParams.endDate}` : ''}`;

    const multiLocationJsonFields = isMultiLocation && activeLocations.length > 1 ? `
  "locationGuides": [
    {
      "destination": "location name",
      "dates": "date range string e.g. 'June 1–5'",
      "climate": "climate type name",
      "climateIcon": "single weather emoji",
      "climateSummary": "2-3 sentence weather description",
      "tempRange": "expected temperature range",
      "precipitation": "precipitation expectation",
      "humidity": "humidity level",
      "weatherForecast": "2-3 sentence date-specific weather assessment",
      "cultureTitle": "short culture heading",
      "cultureSummary": "2-3 sentence cultural overview",
      "cultureNotes": ["array of 3-5 cultural tips relevant to packing and behavior"],
      "localRecommendations": {
        "grocery": ["1-2 grocery or market recommendations"],
        "pharmacy": ["1-2 pharmacy recommendations"],
        "clothing": ["1-2 clothing store recommendations"],
        "restaurants": ["2-3 restaurant or cuisine recommendations"]
      }
    }
  ],` : `
  "climate": "climate type name (e.g. 'Mediterranean', 'Tropical', 'Temperate')",
  "climateIcon": "single weather emoji representing the climate",
  "climateSummary": "2-3 sentence description of weather conditions they can expect",
  "tempRange": "expected temperature range (e.g. '72-88°F / 22-31°C')",
  "precipitation": "precipitation expectation (e.g. 'Low chance of rain')",
  "humidity": "humidity level (e.g. 'Moderate humidity')",
  "weatherForecast": "2-3 sentence specific weather assessment for the exact travel dates based on historical data and seasonal patterns",
  "cultureTitle": "short culture heading (e.g. 'Spanish Culture & Customs')",
  "cultureSummary": "2-3 sentence overview of local culture relevant to travelers",
  "cultureNotes": ["array of 4-6 specific cultural tips relevant to packing and behavior"],
  "localRecommendations": {
    "grocery": ["2-3 grocery store chains or market types common in or near the destination, with a brief note on what to find there"],
    "pharmacy": ["2-3 pharmacy chains or drugstore types common in the destination area"],
    "clothing": ["2-3 clothing store recommendations relevant to the trip style, activities, and destination"],
    "restaurants": ["3-4 restaurant or cuisine recommendations popular at the destination, mentioning cuisine type and what to try"]
  },`;

    const prompt = `You are a professional travel packing consultant and climate expert.

Trip details:
${locationContext}
- Season: ${tripParams.season}
- Interests/Activities: ${tripParams.interests.join(', ')}
- Laundromat access: ${tripParams.hasLaundromat ? 'Yes' : 'No'}
${tripParams.accommodation ? `- Accommodation: ${tripParams.accommodation}` : ''}
${tripParams.transportMode ? `- Transportation: ${tripParams.transportMode}` : ''}
${tripParams.transportDetails?.airport ? `- Departure airport: ${tripParams.transportDetails.airport}` : ''}
${tripParams.transportDetails?.station ? `- Departure station: ${tripParams.transportDetails.station}` : ''}
${tripParams.transportDetails?.departureCity ? `- Departing from: ${tripParams.transportDetails.departureCity}` : ''}
${tripParams.transportDetails?.departureTime ? `- Departure time: ${tripParams.transportDetails.departureTime}` : ''}

Travelers:
${travelerDescriptions}

${isMultiLocation && activeLocations.length > 1
  ? `For each stop in this multi-location trip, provide a separate climate analysis, weather forecast, culture notes, and local recommendations tailored to that specific destination and date range. Then provide combined traveler packing guides that account for all locations — packing for the full trip considering all climates and activities.`
  : `Based on the destination, season, and specific travel dates (if provided), determine the expected climate and provide a weather assessment for those exact dates. Also provide cultural information relevant to packing and travel (dress codes, customs, etiquette, local norms).`
}

If transportation mode is provided, include travel logistics advice:
- For FLYING: Based on the departure airport and time, provide TSA security wait time estimates (typical and peak), recommend what time to arrive at the airport, and note any airport-specific tips (terminal info, pre-check availability). Consider time of day, day of week, and season for wait time estimates.
- For TRAIN: Based on the departure station and time, provide Amtrak check-in recommendations, luggage check-in timing, recommend what time to arrive at the station, and note any station-specific tips.
- For DRIVING: Based on the departure city, destination, and departure time, provide expected traffic conditions, estimated drive time, and recommend the best departure window to avoid congestion.

Then for each traveler, provide a personalized packing guide split into three clear categories. For pets, recommend travel supplies instead of clothing.

Return a JSON object with exactly these fields:
{${multiLocationJsonFields}
  "travelLogistics": {
    "icon": "emoji for mode of transport (✈️, 🚆, or 🚗)",
    "title": "heading like 'Flying from LAX' or 'Driving from Los Angeles'",
    "summary": "2-3 sentence overview with specific arrival time recommendation and wait time estimate",
    "tips": ["array of 3-5 specific logistics tips"]
  },
  "travelerGuides": [
    {
      "travelerLabel": "traveler label from the list above",
      "clothingEssentials": ["array of 6-10 clothing items to pack, gender-appropriate, activity-specific, and suitable for all locations on this trip"],
      "travelEssentials": ["array of 4-6 travel/tech/document/bag essentials (passport, phone charger, power bank, reusable bag, etc.)"],
      "toiletryEssentials": ["array of 4-6 toiletry and personal care essentials appropriate for the destination and accommodation"],
      "recommended": ["array of 4-6 recommended but optional items"],
      "tips": ["array of 3-4 personalized packing tips"]
    }
  ]
}
Return only valid JSON, no other text.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text;
    const jsonText = extractJSON(rawText);
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (err) {
    console.error('packing-guide error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Analyze the overall packing list against trip parameters
app.post('/api/analyze-packing', async (req, res) => {
  try {
    const { items, tripParams, travelerLabel } = req.body;
    if (!items || !tripParams) return res.status(400).json({ error: 'items and tripParams are required' });

    const itemsText = items.map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join('\n');
    const prompt = `You are a professional travel packing consultant.

Trip details:
- Destination: ${tripParams.destination}
- Duration: ${tripParams.duration} days
- Season: ${tripParams.season}
- Interests/Activities: ${tripParams.interests.join(', ')}
- Laundromat access: ${tripParams.hasLaundromat ? 'Yes' : 'No'}
- Luggage size: ${tripParams.luggageSize}
${tripParams.gender ? `- Gender: ${tripParams.gender}` : ''}
${travelerLabel ? `- Packing for: ${travelerLabel}` : ''}

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
    const { items, tripParams, travelerLabel } = req.body;
    if (!items || !tripParams) return res.status(400).json({ error: 'items and tripParams are required' });

    const itemsText = items.map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join('\n');
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const prompt = `You are a professional stylist with up-to-date knowledge of current fashion trends, helping plan outfits for a trip.

Today's date: ${currentDate}

Trip details:
- Destination: ${tripParams.destination}
- Duration: ${tripParams.duration} days
- Season: ${tripParams.season}
- Interests/Activities: ${tripParams.interests.join(', ')}
- Luggage size: ${tripParams.luggageSize}
${tripParams.gender ? `- Gender: ${tripParams.gender}` : ''}
${travelerLabel ? `- Styling for: ${travelerLabel}` : ''}

Available clothing items (numbered):
${itemsText}

Create outfit combinations that reuse items across multiple days. For each outfit, factor in current fashion trends relevant to the specific occasion/activity and destination — and reflect that in the styling description. Only suggest trend-driven tweaks using items the traveler already has, or as an optional accessory note. Return a JSON object with exactly these fields:
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

// Submit feedback — appends 3 rows (one per question) to the CSV
app.post('/api/submit-feedback', (req, res) => {
  try {
    const { ease, satisfaction, recommend, commentEase, commentSatisfaction, commentRecommend, destination } = req.body;

    if (!ease || !satisfaction || !recommend) {
      return res.status(400).json({ error: 'All three ratings are required' });
    }

    const dateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    function csvRow(date, question, rating, comment) {
      const safe = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      return `${safe(date)},${safe(question)},${rating},${safe(comment)}\n`;
    }

    const rows = [
      csvRow(dateStr, 'Ease of Use', ease, commentEase),
      csvRow(dateStr, 'Overall Satisfaction', satisfaction, commentSatisfaction),
      csvRow(dateStr, 'Likelihood to Recommend', recommend, commentRecommend),
    ].join('');

    fs.appendFileSync(FEEDBACK_FILE, rows, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    console.error('submit-feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download feedback CSV — protected by FEEDBACK_KEY
app.get('/api/feedback-download', (req, res) => {
  if (req.query.key !== FEEDBACK_KEY) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    return res.status(404).send('No feedback data yet');
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="PackSmart Feedback.csv"');
  res.sendFile(FEEDBACK_FILE);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PackSmart running at http://localhost:${PORT}`);
});
