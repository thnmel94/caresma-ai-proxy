// api/speak.js
export const config = { runtime: "nodejs" };

const checkToken = (req) => {
  const allow = process.env.TOKENS?.split(",").map(s => s.trim()).filter(Boolean);
  if (!allow?.length) return true;
  const provided = req.headers["x-caresma-token"];
  return allow.includes(provided);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!checkToken(req)) return res.status(401).json({ error: "unauthorized" });

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: "ELEVENLABS_API_KEY not set" });

  try {
    const {
      text,
      voiceId = "Rachel",
      modelId = "eleven_multilingual_v2",
      returnBase64 = true, // set to false to stream MP3 back
    } = req.body || {};

    if (!text) return res.status(400).json({ error: "Missing 'text'" });

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?optimize_streaming_latency=0&output_format=mp3_44100_128`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!r.ok) {
      const errTxt = await r.text();
      return res.status(r.status).json({ error: "tts_failed", details: errTxt });
    }

    const audioBuf = Buffer.from(await r.arrayBuffer());

    if (returnBase64) {
      const b64 = audioBuf.toString("base64");
      return res.status(200).json({
        audioBase64: b64,
        contentType: "audio/mpeg",
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "elevenlabs_failed", details: String(err) });
  }
}
