// api/speak.js
export const config = { runtime: "nodejs" };

/**
 * POST JSON:
 * {
 *   "text": "Hello from Caresma!",
 *   "voice": "Rachel" | "<voice_id>",   // name or raw id; names map below
 *   "model": "eleven_multilingual_v2",  // optional (default shown)
 *   "format": "mp3" | "wav" | "mpeg"    // optional, default mp3
 * }
 *
 * Response:
 * {
 *   "audioBase64": "<base64-audio>",
 *   "contentType": "audio/mpeg",
 *   "voiceUsed": "<resolved_voice_id>"
 * }
 */

const ELEVEN_TTS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// Friendly name → official ElevenLabs voice IDs (extend as you like).
const VOICE_MAP = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  bella: "EXAVITQu4vr4xnSDxMaL",
  antoni: "ErXwobaYiN019PkySvjV",
  elli:   "AZnzlk1XvdvUeBnXmlld",
};

// simple header token gate (same style as other routes)
function checkToken(req) {
  const allowed = (process.env.TOKENS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.length) return true; // public if TOKENS not set
  const incoming = req.headers["x-caresma-token"];
  return allowed.includes(incoming);
}

// if it looks like a raw id, use it; else resolve from VOICE_MAP; else default
function resolveVoiceId(voice) {
  if (!voice) return VOICE_MAP.rachel;
  const v = String(voice).trim();
  if (/^[A-Za-z0-9]{20,}$/.test(v)) return v; // heuristic for raw id
  const byName = VOICE_MAP[v.toLowerCase()];
  return byName || VOICE_MAP.rachel;
}

function contentTypeFor(format) {
  const f = (format || "mp3").toLowerCase();
  if (f === "wav") return "audio/wav";
  if (f === "mpeg" || f === "mp3") return "audio/mpeg";
  return "audio/mpeg";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }
    if (!checkToken(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY not set" });
    }

    const {
      text,
      voice = "Rachel",
      model = "eleven_multilingual_v2",
      format = "mp3",
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Provide non-empty 'text'." });
    }

    const voiceId = resolveVoiceId(voice);
    const contentType = contentTypeFor(format);

    const url = `${ELEVEN_TTS_BASE}/${voiceId}`;
    const elRes = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": contentType,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        // Optional tuning:
        // voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!elRes.ok) {
      let details = {};
      try { details = await elRes.json(); } catch (_) {}
      return res.status(elRes.status).json({
        error: "tts_failed",
        details: JSON.stringify(details),
      });
    }

    const buf = Buffer.from(await elRes.arrayBuffer());
    return res.status(200).json({
      audioBase64: buf.toString("base64"),
      contentType,
      voiceUsed: voiceId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
}
