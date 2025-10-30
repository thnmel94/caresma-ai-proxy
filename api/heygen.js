export const config = { runtime: "nodejs" };

/**
 * POST /api/heygen
 *
 * Body:
 * {
 *   "audio_url": "https://public-url-to-my-voice-line.mp3",
 *   "avatar_id": "optional-overwrite"
 * }
 *
 * Returns:
 * {
 *   "video_id": "...."
 * }
 *
 * Notes:
 * - We REQUIRE audio_url. We no longer support raw text input here because
 *   HeyGen rejected text->voice for this account/plan/avatar.
 * - avatar_id falls back to Thanasis' default avatar.
 */

function isAllowed(req) {
  // same auth model you use in other endpoints
  const token = req.headers["x-caresma-token"];
  const allowedTokens = (process.env.TOKENS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!allowedTokens.length) return true; // no TOKENS set -> open
  return allowedTokens.includes(token);
}

export default async function handler(req, res) {
  // method guard
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // auth guard
  if (!isAllowed(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    return res.status(500).json({ error: "HEYGEN_API_KEY missing" });
  }

  const { audio_url, avatar_id } = req.body || {};

  // enforce audio_url because text->voice is blocked for you
  if (!audio_url) {
    return res.status(400).json({
      error:
        "audio_url is required. Generate speech with /api/speak, host the MP3 somewhere public, then send that URL here."
    });
  }

  // build HeyGen payload in the ONLY format they accept for you (voice.type='audio')
  const payload = {
    video_inputs: [
      {
        avatar: {
          avatar_id:
            avatar_id || "d08c85e6cff84d78b6dc41d83a2eccce" // <-- your avatar
        },
        voice: {
          type: "audio",
          audio_url: audio_url
        }
      }
    ],
    dimension: { width: 1280, height: 720 },
    background: "white"
  };

  // call HeyGen
  const r = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": HEYGEN_API_KEY,
      Authorization: `Bearer ${HEYGEN_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json();

  // normalize response to something nice like your other endpoints
  if (!r.ok) {
    return res.status(r.status).json({
      error: data?.error || "heygen_failed",
      details: data
    });
  }

  // success path
  return res.status(200).json({
    error: null,
    data: {
      video_id: data?.data?.video_id || data?.video_id || null
    }
  });
}
