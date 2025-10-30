// api/heygen.js

export default async function handler(req, res) {
  //
  // 1. Allow only POST
  //
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  //
  // 2. AUTH (same pattern as generate / transcribe / speak)
  //
  // Caller must send header: x-caresma-token: <token>
  // Vercel must have env var: TOKENS="token1,token2,token3"
  //
  const clientToken = req.headers['x-caresma-token'];

  const allowedTokens = (process.env.TOKENS || "")
    .split(',')
    .map(t => t.trim())
    .filter(Boolean); // remove empty strings if there's a double comma

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    //
    // 3. INPUT from candidate
    //
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Missing script' });
    }

    // safety limit so they can't burn credits with a book
    const safeScript = script.slice(0, 400);

    //
    // 4. Build payload for HeyGen
    //
    // IMPORTANT:
    // - avatar_id and voice_id must be valid in your HeyGen account
    // - we fixed `dimension` to the shape HeyGen expects
    //
    const payload = {
      avatar_id: 'Tyrone-default',        // TODO: replace with a real avatar id from HeyGen
      voice_id: 'en_us_male',             // TODO: replace with a real voice id from HeyGen
      input_text: safeScript,
      dimension: { width: 1280, height: 720 }, // <-- FIXED based on HeyGen error message
      background: 'white'
    };

    //
    // 5. Call HeyGen API
    //
    // We're using v2/video/generate which responded last time (no 404).
    //
    const heygenResp = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    //
    // 6. Read and forward HeyGen's response
    //
    // We don't assume it's valid JSON always, so we try/catch.
    //
    const rawText = await heygenResp.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    return res.status(heygenResp.status).json(parsed);

  } catch (err) {
    console.error('HeyGen proxy fatal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
