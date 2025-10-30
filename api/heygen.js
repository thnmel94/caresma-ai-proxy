// api/heygen.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Missing script' });
    }

    const safeScript = script.slice(0, 400); // limit length to prevent abuse

    const payload = {
      avatar_id: 'Tyrone-default',  // you can change this to any free avatar ID
      voice_id: 'en_us_male',
      input_text: safeScript,
      dimension: '720p',
      background: 'white'
    };

    const response = await fetch('https://api.heygen.com/v1/video.generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('HeyGen proxy error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
