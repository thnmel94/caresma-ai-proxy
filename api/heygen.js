// api/heygen.js

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- AUTH CHECK (same as other endpoints) ---
  const clientToken = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get full payload from candidate
    const body = req.body || {};

    // Basic validation
    if (!body.video_inputs && !body.script) {
      return res.status(400).json({
        error: "Missing required fields. Send either full video_inputs array or script."
      });
    }

    // Allow two ways to use:
    // 1️⃣ They send a full HeyGen payload (advanced)
    // 2️⃣ They send just a simple { script, avatar_id, voice_id } (we’ll build it)
    let payload;

    if (body.video_inputs) {
      // Pass full HeyGen-style payload directly (no restrictions)
      payload = body;
    } else {
      // Simple mode (we’ll build the payload for them)
      const script = String(body.script || "").slice(0, 1000);
      const avatar_id = body.avatar_id || "Tyrone-default";
      const voice_id = body.voice_id || "en_us_male";

      payload = {
        video_inputs: [
          {
            character: { type: "avatar", avatar_id },
            voice: { type: "text", voice_id },
            input_text: script
          }
        ],
        dimension: { width: 1280, height: 720 },
        background: "white"
      };
    }

    // Call HeyGen API
    const heygenResp = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY
      },
      body: JSON.stringify(payload)
    });

    // Read response (sometimes not valid JSON)
    const rawText = await heygenResp.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    return res.status(heygenResp.status).json(parsed);

  } catch (err) {
    console.error("HeyGen proxy fatal error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
