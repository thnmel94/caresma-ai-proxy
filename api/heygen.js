export const config = { runtime: "nodejs" };

console.log("🔥 heygen.js AUDIO-ONLY BUILD = C1");

function isAllowed(req) {
  const token = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!allowedTokens.length) return true;
  return allowedTokens.includes(token);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAllowed(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    return res.status(500).json({ error: "HEYGEN_API_KEY missing" });
  }

  const { audio_url, avatar_id } = req.body || {};

  if (!audio_url) {
    return res.status(400).json({
      error:
        "audio_url is required. Use /api/speak to generate speech, host that MP3 publicly, then pass its URL here."
    });
  }

  const payload = {
    video_inputs: [
      {
        avatar: {
          avatar_id:
            avatar_id || "d08c85e6cff84d78b6dc41d83a2eccce"
        },
        voice: {
          type: "audio",
          audio_url: audio_url
        }
      }
    ],
    dimension: { width: 1280, height: 720 },
    background: "white"
  };

  console.log("🚀 PAYLOAD TO HEYGEN >>>", JSON.stringify(payload, null, 2));

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

  if (!r.ok) {
    return res.status(r.status).json({
      error: data?.error || "heygen_failed",
      details: data
    });
  }

  return res.status(200).json({
    error: null,
    data: {
      video_id: data?.data?.video_id || data?.video_id || null
    }
  });
}
