// ── analyzer/api.js ───────────────────────────────────────
// Supports multiple AI providers:
//   - Google Gemini (free tier — default)
//   - Anthropic Claude
//   - OpenAI
//
// Set in .env:
//   GEMINI_API_KEY=...        → uses Gemini (free)
//   ANTHROPIC_API_KEY=...     → uses Claude
//   OPENAI_API_KEY=...        → uses OpenAI
//
// Priority: Gemini → Anthropic → OpenAI

const https  = require("https");
const config = require("../config");

// ── Detect which provider to use ─────────────────────────
function getProvider() {
  if (process.env.GEMINI_API_KEY)    return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY)    return "openai";
  return null;
}

function getApiKey() {
  if (process.env.GEMINI_API_KEY)    return process.env.GEMINI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY)    return process.env.OPENAI_API_KEY;
  return "";
}

// ── Default model per provider ────────────────────────────
function getModel(provider) {
  if (process.env.AI_REVIEWER_MODEL) return process.env.AI_REVIEWER_MODEL;
  if (provider === "gemini")    return "gemini-1.5-flash";
  if (provider === "anthropic") return "claude-3-5-haiku-20241022";
  if (provider === "openai")    return "gpt-4o-mini";
  return "gemini-1.5-flash";
}

// ── Raw HTTPS request helper ──────────────────────────────
function httpsRequest({ hostname, path, method = "POST", headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", (e) => reject(new Error(`Network error: ${e.message}`)));
    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error("Request timed out after 90s"));
    });
    req.write(body);
    req.end();
  });
}

// ── Gemini ────────────────────────────────────────────────
async function callGemini(prompt, apiKey, model) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 3500,
    },
  });

  const data = await httpsRequest({
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Anthropic ─────────────────────────────────────────────
async function callAnthropic(prompt, apiKey, model) {
  const body = JSON.stringify({
    model,
    max_tokens: 3500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const data = await httpsRequest({
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (data.error) {
    throw new Error(`Anthropic error: ${data.error.message}`);
  }

  return data.content?.[0]?.text || "";
}

// ── OpenAI ────────────────────────────────────────────────
async function callOpenAI(prompt, apiKey, model) {
  const body = JSON.stringify({
    model,
    max_tokens: 3500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const data = await httpsRequest({
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (data.error) {
    throw new Error(`OpenAI error: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content || "";
}

// ── Main export ───────────────────────────────────────────
async function callAI(prompt) {
  const provider = getProvider();
  const apiKey   = getApiKey();
  const model    = getModel(provider);

  if (!provider || !apiKey) {
    throw new Error(
      "No API key found. Add one of these to your .env:\n" +
      "  GEMINI_API_KEY=...        (free)\n" +
      "  ANTHROPIC_API_KEY=...     ($5 free credits)\n" +
      "  OPENAI_API_KEY=...        (paid)"
    );
  }

  if (process.env.AI_REVIEWER_VERBOSE === "true") {
    process.stderr.write(`  [ai-reviewer] provider: ${provider} | model: ${model}\n`);
  }

  if (provider === "gemini")    return callGemini(prompt, apiKey, model);
  if (provider === "anthropic") return callAnthropic(prompt, apiKey, model);
  if (provider === "openai")    return callOpenAI(prompt, apiKey, model);
}

// ── Parse metadata from review response ──────────────────
function parseMetadata(review) {
  const defaults = {
    has_blockers: false,
    new_patterns_found: [],
    categories_flagged: [],
    top_issue: "",
  };

  if (review.includes("LGTM")) return defaults;

  try {
    const match = review.match(
      /REVIEW_METADATA_START\s*([\s\S]*?)\s*REVIEW_METADATA_END/
    );
    if (!match) return defaults;
    return { ...defaults, ...JSON.parse(match[1]) };
  } catch {
    return defaults;
  }
}

module.exports = { callAI, parseMetadata };