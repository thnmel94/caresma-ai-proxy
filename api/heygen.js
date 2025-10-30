// api/heygen.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { script, avatar_id, voice_id, audio_url } = req.body || {};

    if (!script && !audio_url) {
      return res.status(400).json({
        error: "You must provide either 'script' (text) or 'audio_url'."
      });
    }

    const videoInput = {
      character: {
        type: "avatar",
        avatar_id: avatar_id || "5f4b7d15bde33a001f8c6529"
      },
      voice: {}
    };

    if (audio_url) {
      // Option A — use pre-recorded audio (e.g., from ElevenLabs)
      videoInput.voice = {
        type: "audio",
        audio_url
      };
    } else {
      // Option B — use HeyGen’s internal TTS
      videoInput.voice = {
        type: "text",
        voice_id: voice_id || "en_us_male",
        text: script // ✅ CORRECT FIELD
      };
    }

    const payload = {
      video_inputs: [videoInput],
      dimension: { width: 1280, height: 720 },
      background: "white"
    };

    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("HeyGen proxy error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
