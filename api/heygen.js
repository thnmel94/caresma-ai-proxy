export const config = { runtime: "nodejs" };

console.log("🔥 heygen.js BUILD ID = B7");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    return res.status(500).json({ error: "HEYGEN_API_KEY missing" });
  }

  const { script, voice_id, audio_url, avatar_id } = req.body || {};

  if (!script && !audio_url) {
    return res.status(400).json({
      error: "You must provide either 'script' or 'audio_url'."
    });
  }

  // Build the block HeyGen expects
  const videoInput = {
    avatar: {
      avatar_id: avatar_id || "d08c85e6cff84d78b6dc41d83a2eccce"
    },
    voice: audio_url
      ? {
          type: "audio",
          audio_url
        }
      : {
          type: "text",
          voice_id: voice_id || "en_us_male",
          text: {
            input_text: script // <- IMPORTANT
          }
        }
  };

  const payload = {
    video_inputs: [videoInput],
    dimension: { width: 1280, height: 720 },
    background: "white"
  };

  console.log("🚀 SENDING TO HEYGEN >>>", JSON.stringify(payload, null, 2));

  const r = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": HEYGEN_API_KEY,
      Authorization: `Bearer ${HEYGEN_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json();

  console.log("📬 HEYGEN RESPONSE <<<", JSON.stringify(data, null, 2));

  return res.status(r.status).json(data);
}
