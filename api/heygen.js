// api/heygen.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- AUTH ---
  const clientToken = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!allowedTokens.includes(clientToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { script } = req.body;
    if (!script) {
      return res.status(400).json({ error: "Missing script" });
    }

    const safeScript = script.slice(0, 400);

    // --- PAYLOAD (final version) ---
    const payload = {
      video_inputs: [
        {
          character: {
            type: "avatar",              // 👈 NEW REQUIRED FIELD
            avatar_id: "Tyrone-default", // replace with valid ID from your HeyGen account
            voice_id: "en_us_male"       // replace with valid voice ID
          },
          input_text: safeScript
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
