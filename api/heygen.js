// api/heygen.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---- Auth check (same pattern as other routes) ----
  const clientToken = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { script, avatar_id, voice_id, audio_url } = req.body || {};

    // Must give at least some speech source:
    // - either script (text -> TTS)
    // - or audio_url (pre-recorded audio)
    if (!script && !audio_url) {
      return res.status(400).json({
        error:
          "Either 'script' (text for TTS) or 'audio_url' (URL to an mp3) is required."
      });
    }

    // Build one video input
    const videoInput = {
      character: {
        type: "avatar",
        avatar_id: avatar_id || "5f4b7d15bde33a001f8c6529" // fallback
      },
      voice: {}
    };

    if (audio_url) {
      // Use external audio (like ElevenLabs mp3)
      videoInput.voice = {
        type: "audio",
        audio_url: audio_url
      };
    } else {
      // Use HeyGen TTS
      videoInput.voice = {
        type: "text",
        voice_id: voice_id || "en_us_male",
        // IMPORTANT CHANGE: HeyGen is expecting "text": "<string>"
        text: script
      };
    }

    const payload = {
      video_inputs: [videoInput],
      dimension: { width: 1280, height: 720 },
      background: "white"
    };

    // Send to HeyGen
    const upstream = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const raw = await upstream.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { raw };
    }

    return res.status(upstream.status).json(json);
  } catch (err) {
    console.error("HeyGen proxy error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
