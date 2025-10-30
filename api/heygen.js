// api/heygen.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- AUTH CHECK ---
  const token = req.headers["x-caresma-token"];
  const allowed = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!allowed.includes(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { script, avatar_id, voice_id, audio_url } = req.body || {};

    // --- BASIC VALIDATION ---
    if (!script && !audio_url) {
      return res
        .status(400)
        .json({ error: "Either 'script' or 'audio_url' must be provided." });
    }

    // --- BUILD HEYGEN PAYLOAD ---
    const videoInput = {
      character: {
        type: "avatar",
        avatar_id: avatar_id || "Tyrone-default",
      },
      voice: {},
    };

    // Use either text-to-speech or pre-generated audio
    if (audio_url) {
      videoInput.voice = {
        type: "audio",
        audio_url,
      };
    } else {
      videoInput.voice = {
        type: "text",
        voice_id: voice_id || "en_us_male",
        text: { input_text: script },
      };
    }

    const payload = {
      video_inputs: [videoInput],
      dimension: { width: 1280, height: 720 },
      background: "white",
    };

    // --- SEND TO HEYGEN ---
    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return res.status(response.status).json(json);
  } catch (err) {
    console.error("HeyGen proxy error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
