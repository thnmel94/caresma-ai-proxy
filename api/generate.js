// api/generate.js
export const config = { runtime: "nodejs" };

/**
 * POST JSON:
 * { "messages": [{ "role":"user","content":"Hello from Caresma!" }], "model":"gpt-4o-mini" }
 *
 * Response proxies OpenAI Chat Completions.
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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    const body = req.body || {};
    const messages =
      body.messages ||
      [{ role: "user", content: "Hello from Caresma!" }];
    const model = body.model || "gpt-4o-mini-2024-07-18";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "openai_failed", details: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
}
