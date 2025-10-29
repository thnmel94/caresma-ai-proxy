// api/transcribe.js
export const config = { runtime: "nodejs" };

// shared tiny auth helper
const checkToken = (req) => {
  const allow = process.env.TOKENS?.split(",").map(s => s.trim()).filter(Boolean);
  if (!allow?.length) return true;             // no TOKENS set = public
  const provided = req.headers["x-caresma-token"];
  return allow.includes(provided);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!checkToken(req)) return res.status(401).json({ error: "unauthorized" });

  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) return res.status(500).json({ error: "DEEPGRAM_API_KEY not set" });

  try {
    const { source, audioBase64, mime = "audio/mpeg", model = "nova-2" } = req.body || {};

    if (!source && !audioBase64) {
      return res.status(400).json({ error: "Provide either 'source' (URL) or 'audioBase64'" });
    }

    // Option A: remote URL to audio
    if (source) {
      const dgRes = await fetch(`https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: source }),
      });

      const out = await dgRes.json();
      if (!dgRes.ok) return res.status(dgRes.status).json(out);

      const transcript = out?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
      return res.status(200).json({ transcript, raw: out });
    }

    // Option B: base64-encoded audio blob
    const raw = Buffer.from(audioBase64, "base64");
    const dgRes = await fetch(`https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": mime, // e.g., audio/webm;codecs=opus or audio/mpeg
      },
      body: raw,
    });

    const out = await dgRes.json();
    if (!dgRes.ok) return res.status(dgRes.status).json(out);

    const transcript = out?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return res.status(200).json({ transcript, raw: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "deepgram_failed", details: String(err) });
  }
}
