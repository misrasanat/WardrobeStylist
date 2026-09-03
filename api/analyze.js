const MODEL = 'gemini-3.5-flash-lite'

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: {
      type: 'STRING',
      enum: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'],
    },
    subcategory: { type: 'STRING', maxLength: 30 },
    primary_color: { type: 'STRING', maxLength: 30 },
    secondary_colors: { type: 'ARRAY', items: { type: 'STRING', maxLength: 30 }, maxItems: 4 },
    pattern: { type: 'STRING', maxLength: 30 },
    seasons: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: ['spring', 'summer', 'fall', 'winter'] },
    },
    style_tags: { type: 'ARRAY', items: { type: 'STRING', maxLength: 20 }, maxItems: 4 },
    material: { type: 'STRING', maxLength: 30 },
  },
  required: ['category', 'primary_color', 'seasons', 'style_tags'],
}

const PROMPT = `You are a fashion cataloging assistant. Look at this photo of a single clothing
item and describe it. Respond only with the requested JSON fields:
- category: one of top, bottom, dress, outerwear, shoes, accessory
- subcategory: a short specific name, 1-3 words (e.g. "t-shirt", "jeans", "sneakers")
- primary_color: the dominant color, in plain English (e.g. "navy blue")
- secondary_colors: any other notable colors, as a short list (can be empty)
- pattern: e.g. "solid", "striped", "floral", "plaid", "graphic print"
- seasons: which seasons this item suits (can be multiple)
- style_tags: 2-4 style descriptors (e.g. "casual", "formal", "sporty", "streetwear", "business")
- material: best guess at fabric/material if visible, otherwise omit`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' })
  }

  const { image, mimeType } = req.body ?? {}
  if (!image || !mimeType) {
    return res.status(400).json({ error: 'Missing image or mimeType' })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image } }],
            },
          ],
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
      return res.status(502).json({ error: 'Gemini returned no analysis' })
    }

    const tags = JSON.parse(text)
    return res.status(200).json(tags)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
