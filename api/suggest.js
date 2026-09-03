const MODEL = 'gemini-3.6-flash'

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING', maxLength: 40 },
      item_ids: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 6 },
      rationale: { type: 'STRING', maxLength: 280 },
    },
    required: ['title', 'item_ids', 'rationale'],
  },
}

function buildPrompt(items, occasion, season) {
  const catalog = items.map(({ id, category, subcategory, primary_color, secondary_colors, pattern, seasons, style_tags, material }) => ({
    id, category, subcategory, primary_color, secondary_colors, pattern, seasons, style_tags, material,
  }))

  return `You are a personal stylist. Here is the user's wardrobe catalog as JSON:
${JSON.stringify(catalog)}

Suggest 3 distinct complete outfits using ONLY the item ids above (never invent new ids).
Each outfit should form a wearable combination (typically a top + bottom, or a dress, plus
optionally outerwear/shoes/accessories) with good color and style coherence.
${occasion ? `The occasion is: ${occasion}.` : ''}
${season ? `It should suit this season: ${season}.` : ''}
For each outfit give: a short catchy title, the list of item ids used, and a one or two
sentence rationale explaining why the colors/styles work together and why it fits the
occasion/season. If the wardrobe lacks enough variety, still return your best 3 attempts.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' })
  }

  const { items, occasion, season } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No wardrobe items provided' })
  }

  const validIds = new Set(items.map((item) => item.id))

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(items, occasion, season) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return res.status(502).json({ error: `Gemini error: ${text}` })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return res.status(502).json({ error: 'Gemini returned no suggestions' })
    }

    const outfits = JSON.parse(text)
      .map((outfit) => ({
        ...outfit,
        item_ids: outfit.item_ids.filter((id) => validIds.has(id)),
      }))
      .filter((outfit) => outfit.item_ids.length >= 2)

    return res.status(200).json({ outfits })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
