// api/transcribe.js
export const config = { runtime: "nodejs" };

/**
 * POST JSON:
 * {
 *   "source": "https://.../audio.wav"   // OR
 *   "audioBase64": "<base64 audio>",   // optional alternative
 *   "model": "nova-2"                  // optional, defaults nova-2
 * }
 *
 * Response:
 * { "transcript": "....", "raw": { ...deepgram json... } }
 */

function checkToken(req) {
  const allowed = (process.env.TOKENS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.length) return true;
  const incoming = req.headers["x-caresma-token"];
  return allowed.includes(incoming);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }
    if (!checkToken(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const DG_KEY = process.env.DEEPGRAM_API_KEY;
    if (!DG_KEY) {
      return res.status(500).json({ error: "DEE PGRAM_API_KEY not set" });
    }

    const { source, audioBase64, model = "nova-2" } = req.body || {};
    if (!source && !audioBase64) {
      return res.status(400).json({ error: "Provide 'source' URL or 'audioBase64'." });
    }

    let dgRes;
    if (source) {
      // Remote file
      dgRes = await fetch(
        `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DG_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: source }),
        }
      );
    } else {
      // Base64 blob
      const raw = Buffer.from(audioBase64, "base64");
      dgRes = await fetch(
        `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DG_KEY}`,
            "Content-Type": "audio/mpeg", // or correct mime for your audio
          },
          body: raw,
        }
      );
    }

    if (!dgRes.ok) {
      let details = {};
      try { details = await dgRes.json(); } catch (_) {}
      return res.status(dgRes.status).json({ error: "deepgram_failed", details });
    }

    const out = await dgRes.json();
    const transcript =
      out?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    return res.status(200).json({ transcript, raw: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
}
