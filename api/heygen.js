export const config = { runtime: "nodejs" };

function isAllowed(req) {
  const token = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  // if TOKENS is empty, allow everything
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
    return res
      .status(500)
      .json({ error: "HEYGEN_API_KEY not set in environment" });
  }

  try {
    const { script, avatar_id, voice_id, audio_url } = req.body || {};

    // you must send either text we should say OR a ready-made audio file
    if (!script && !audio_url) {
      return res.status(400).json({
        error:
          "You must provide either 'script' (text) or 'audio_url' (TTS/mp3)."
      });
    }

    // --- Build one video input block in HeyGen's expected structure ---
    // (A) Avatar block
    const videoInput = {
      avatar: {
        avatar_id:
          avatar_id || "5f4b7d15bde33a001f8c6529" // <- fallback so it doesn't crash
      },
      voice: {}
    };

    // (B) Voice block
    if (audio_url) {
      // Option A — you give us prerecorded audio from e.g. ElevenLabs
      videoInput.voice = {
        type: "audio",
        audio_url: audio_url
      };
    } else {
      // Option B — you want HeyGen to generate speech from text
      videoInput.voice = {
        type: "text",
        voice_id: voice_id || "en_us_male",
        text: {
          // THIS is the critical fix
          input_text: script
        }
      };
    }

    // (C) Full payload for HeyGen
    const payload = {
      video_inputs: [videoInput],
      dimension: { width: 1280, height: 720 },
      background: "white"
    };

    // --- Call HeyGen ---
    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // send both styles to be safe
        "X-Api-Key": HEYGEN_API_KEY,
        Authorization: `Bearer ${HEYGEN_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // pass through HeyGen response & status code so you see real errors if any
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("HeyGen proxy error:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: String(error) });
  }
}
