// api/generate.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-caresma-token");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const providedToken = req.headers["x-caresma-token"];
  if (allowedTokens.length && !allowedTokens.includes(providedToken)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    req.on("error", reject);
  });

  const messages = body.messages || [{ role: "user", content: "Hello from Caresma!" }];

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
