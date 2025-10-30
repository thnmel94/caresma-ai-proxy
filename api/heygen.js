export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // auth gate
  const clientToken = req.headers['x-caresma-token'];
  if (clientToken !== process.env.CARESMA_PROXY_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Missing script' });
    }

    const safeScript = script.slice(0, 400);

    // send a minimal payload HeyGen will accept for "quick avatar video"
    const payload = {
      avatar_id: 'Tyrone-default',
      voice_id: 'en_us_male',
      input_text: safeScript,
      dimension: '720p',
      background: 'white'
    };

    // 🔁 NOTE: changed endpoint here to /v1/videos/generate
    const heygenResp = await fetch('https://api.heygen.com/v1/videos/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    // don't assume JSON; read raw
    const rawText = await heygenResp.text();

    // try to parse json, fallback to raw string
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    // instead of throwing 500, forward HeyGen's status + parsed body
    return res.status(heygenResp.status).json(parsed);

  } catch (err) {
    console.error('HeyGen proxy fatal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
