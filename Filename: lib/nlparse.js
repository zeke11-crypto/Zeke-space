// Converts a natural-language description ("people looking for someone to
// build a custom AI workflow") into an X advanced-search operator string.
//
// If ANTHROPIC_API_KEY is set, we ask Claude to do this properly. If not,
// we fall back to a zero-dependency heuristic so the app still works with
// no paid keys at all.

const INTENT_PHRASES = [
  "looking for",
  "anyone know",
  "does anyone",
  "recommend a",
  "recommendations for",
  "need help with",
  "need someone to",
  "who can help",
  "who can build",
  "hiring a",
  "hiring someone",
  "any good",
  "where can i find",
];

/**
 * @param {string} description - natural language description of intent
 * @param {string|undefined} anthropicKey
 * @returns {Promise<string>} an advanced-search query string
 */
export async function naturalLanguageToQuery(description, anthropicKey) {
  if (anthropicKey) {
    try {
      return await claudeParse(description, anthropicKey);
    } catch (err) {
      // Fall through to heuristic rather than failing the whole request.
      console.error("Claude NL parse failed, using heuristic fallback:", err);
    }
  }
  return heuristicParse(description);
}

async function claudeParse(description, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Convert this description into a single X/Twitter advanced-search query string using operators like OR, quoted phrases, and -exclusions. Return ONLY the query string, nothing else — no explanation, no quotes around the whole thing, no markdown.

Description: "${description}"

Example input: "people looking for someone to build a custom AI workflow"
Example output: ("need someone to build" OR "looking for a developer" OR "anyone know how to automate") (AI OR automation OR workflow)`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content
    ?.map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  if (!text) throw new Error("Empty response from Claude");
  return text;
}

// Free fallback: pull out meaningful keywords, pair them with a handful of
// generic "looking for help" phrases so the search still has real recall
// without any LLM call.
function heuristicParse(description) {
  const stopwords = new Set([
    "people", "who", "are", "is", "for", "someone", "the", "a", "an", "to",
    "with", "and", "or", "of", "in", "on", "help", "me", "i", "want",
  ]);

  const keywords = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const uniqueKeywords = [...new Set(keywords)].slice(0, 6);
  const keywordClause = uniqueKeywords.length
    ? `(${uniqueKeywords.join(" OR ")})`
    : "";

  const intentClause = `(${INTENT_PHRASES.map((p) => `"${p}"`).join(" OR ")})`;

  return [intentClause, keywordClause].filter(Boolean).join(" ");
}
