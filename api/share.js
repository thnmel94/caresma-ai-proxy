export const config = { runtime: "nodejs" };

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
  if (!isAllowed(req)) return res.status(401).json({ error: "Unauthorized" });

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) return res.status(500).json({ error: "HEYGEN_API_KEY missing" });

  const { video_id } = req.body || {};
  if (!video_id) return res.status(400).json({ error: "Missing video_id" });

  try {
    const r = await fetch("https://api.heygen.com/v1/video/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HEYGEN_API_KEY}`,
        "X-Api-Key": HEYGEN_API_KEY
      },
      body: JSON.stringify({ video_id })
    });

    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "heygen_share_failed", details: body });

    const d = body?.data || body;
    return res.status(200).json({
      video_id,
      share_url: d?.url || d?.share_url || null, // permanent public link
      raw: d
    });
  } catch (err) {
    return res.status(500).json({ error: "server_error", details: String(err?.message || err) });
  }
}
