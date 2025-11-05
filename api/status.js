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
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAllowed(req)) return res.status(401).json({ error: "Unauthorized" });

  const { video_id } = req.query || {};
  if (!video_id) return res.status(400).json({ error: "Missing video_id" });

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) return res.status(500).json({ error: "HEYGEN_API_KEY missing" });

  try {
    const url = new URL("https://api.heygen.com/v1/video_status.get");
    url.searchParams.set("video_id", String(video_id));

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${HEYGEN_API_KEY}`,
        "X-Api-Key": HEYGEN_API_KEY
      }
    });

    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "heygen_status_failed", details: body });

    const d = body?.data || body;
    return res.status(200).json({
      video_id,
      status: d?.status,                // "processing" | "completed" | "failed"
      progress: d?.progress ?? null,
      duration: d?.duration ?? null,
      video_url: d?.video_url ?? null,  // temporary/expires
      thumbnail_url: d?.cover_image_url ?? null,
      raw: d
    });
  } catch (err) {
    return res.status(500).json({ error: "server_error", details: String(err?.message || err) });
  }
}
