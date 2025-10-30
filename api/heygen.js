// api/heygen.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic auth via header
  const clientToken = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body || {};

    // If candidate sends a full HeyGen payload, pass it directly
    if (body.video_inputs) {
      const heygenResp = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.HEYGEN_API_KEY
        },
        body: JSON.stringify(body)
      });

      const text = await heygenResp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      return res.status(heygenResp.status).json(json);
    }

    // If candidate sends just {script, avatar_id, voice_id}, build a minimal HeyGen payload
    const { script, avatar_id, voice_id } = body;

    if (!script) {
      return res.status(400).json({ error: "Missing script" });
    }

    const payload = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatar_id || "Tyrone-default"
          },
          voice: {
            type: "text",
            voice_id: voice_id || "en_us_male",
            text: { input_text: script } // ✅ fixed structure HeyGen expects
          }
        }
      ],
      dimension: { width: 1280, height: 720 },
      background: "white"
    };

    const heygenResp = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const text = await heygenResp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return res.status(heygenResp.status).json(json);
  } catch (err) {
    console.error("HeyGen proxy error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
