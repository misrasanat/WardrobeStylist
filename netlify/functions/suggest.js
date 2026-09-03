const MODEL = 'gemini-3.5-flash-lite'

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

function buildPrompt(items, occasion, season, feedback) {
  const catalog = items.map(({ id, category, subcategory, primary_color, secondary_colors, pattern, seasons, style_tags, material }) => ({
    id, category, subcategory, primary_color, secondary_colors, pattern, seasons, style_tags, material,
  }))

  let feedbackContext = ''
  if (feedback.liked.length > 0 || feedback.disliked.length > 0) {
    feedbackContext = `\n\nSTYLE LEARNING:
${feedback.liked.length > 0 ? `The user LOVED these combinations (learn their style from these):
${feedback.liked.map(f => `- Items [${f.item_ids.join(', ')}]: ${describeCombo(items, f.item_ids)}`).join('\n')}` : ''}
${feedback.disliked.length > 0 ? `The user DISLIKED these combinations (avoid similar patterns):
${feedback.disliked.map(f => `- Items [${f.item_ids.join(', ')}]: ${describeCombo(items, f.item_ids)}`).join('\n')}` : ''}

Use this feedback to understand their aesthetic preferences and suggest outfits aligned with what they love.`
  }

  return `You are an expert fashion stylist. Here is the user's wardrobe:
${JSON.stringify(catalog)}
${feedbackContext}

STYLING RULES (CRITICAL):
1. COLOR HARMONY: Use complementary or analogous colors. Avoid clashing (e.g. red+pink, orange+purple unless intentional high-fashion).
   - Neutrals (black, white, gray, beige, navy) pair with anything
   - Denim goes with almost any color
   - Monochrome (all one color family) is always safe
   - Pops of color work best as accents (1 colorful piece + neutrals)

2. OUTFIT STRUCTURE: Not every outfit needs a jacket!
   - Warm weather: top + bottom, or just a dress
   - Cool weather: add outerwear ONLY if it makes sense
   - Shoes and accessories are optional finishing touches, not requirements

3. LAYERING RULES (CRITICAL - NO EXCEPTIONS):
   - NEVER pair a hoodie with a jacket/blazer/outerwear - pick ONE outer layer
   - NEVER put outerwear over outerwear (no jacket over jacket)
   - Hoodies are the outer layer - they don't go under jackets
   - Valid layers: base layer (t-shirt/tank) → mid layer (shirt/sweater) → outerwear (jacket/coat/hoodie)
   - A hoodie IS outerwear, not a mid-layer

4. PATTERN MIXING: Generally avoid multiple bold patterns unless you're confident they work
   - One patterned piece + solid pieces is safest
   - Small patterns can work with larger ones if colors align

5. STYLE COHERENCE: Mix tags within reason (casual + sporty works, formal + streetwear usually doesn't)
   - Keep the vibe consistent (don't pair a blazer with gym shorts)

6. SEASON MATCHING: ${season ? `It's ${season} - dress appropriately.` : 'Check item seasons and dress weather-appropriate.'}
   - Summer: light fabrics, no heavy outerwear
   - Winter: layers, outerwear appropriate

${occasion ? `OCCASION: ${occasion} - style accordingly.` : ''}

Suggest 3 distinct, genuinely stylish outfits using ONLY item ids from the catalog (never invent ids).
Each outfit should look cohesive and intentional, not randomly thrown together.
Return: title (short, catchy), item_ids (the specific items), rationale (why this combo works - colors, style, occasion).`
}

function describeCombo(items, ids) {
  const pieces = ids.map(id => {
    const item = items.find(i => i.id === id)
    return item ? `${item.primary_color} ${item.subcategory || item.category}` : 'item'
  }).filter(Boolean)
  return pieces.join(' + ')
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server missing GEMINI_API_KEY' })
    }
  }

  const { items, occasion, season, feedback } = JSON.parse(event.body || '{}')
  if (!Array.isArray(items) || items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No wardrobe items provided' })
    }
  }

  const userFeedback = feedback || { liked: [], disliked: [] }
  const validIds = new Set(items.map((item) => item.id))

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(items, occasion, season, userFeedback) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Gemini error: ${text}` })
      }
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Gemini returned no suggestions' })
      }
    }

    const outfits = JSON.parse(text)
      .map((outfit) => ({
        ...outfit,
        item_ids: outfit.item_ids.filter((id) => validIds.has(id)),
      }))
      .filter((outfit) => outfit.item_ids.length >= 2)

    return {
      statusCode: 200,
      body: JSON.stringify({ outfits })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
