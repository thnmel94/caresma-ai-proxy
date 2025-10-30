export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. AUTH (same logic as generate / transcribe / speak)
  // We expect header: x-caresma-token: <token>
  // We expect Vercel env var: TOKENS="token1,token2,token3"
  const clientToken = req.headers['x-caresma-token'];

  // process.env.TOKENS might look like: "caresma2025,,kucheruk"
  // so we split on commas, trim spaces, and drop empty strings
  const allowedTokens = (process.env.TOKENS || "")
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 3. INPUT VALIDATION
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Missing script' });
    }

    // hard cap to stop abuse / cost drain
    const safeScript = script.slice(0, 400);

    // 4. BUILD HEYGEN PAYLOAD
    // NOTE: these IDs (avatar_id, voice_id) must be valid for your HeyGen account.
    // You can adjust once we see HeyGen's response.
    const payload = {
      avatar_id: 'Tyrone-default',   // TODO: replace with a real avatar your plan allows
      voice_id: 'en_us_male',        // TODO: replace with a real voice id
      input_text: safeScript,
      dimension: '720p',
      background: 'white'
    };

    // 5. CALL HEYGEN
    // We’re using /v1/videos/generate which is a common pattern.
    // If HeyGen responds with an error, we'll forward it back to the caller.
    const heygenResp = await fetch('https://api.heygen.com/v1/videos/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    // 6. READ RAW RESPONSE (don’t assume valid JSON)
    const rawText = await heygenResp.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If HeyGen gave us HTML or plain text (like "upgrade plan"), return that so we see it
      parsed = { raw: rawText };
    }

    // 7. RETURN HEYGEN'S RESULT (no 500 unless we truly crash)
    return res.status(heygenResp.status).json(parsed);

  } catch (err) {
    console.error('HeyGen proxy fatal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
