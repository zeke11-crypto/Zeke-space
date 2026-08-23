// Thin wrapper around TwitterAPI.io's advanced search endpoint.
// Docs: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
// GET https://api.twitterapi.io/twitter/tweet/advanced_search
// Header: X-API-Key
// Params: query (full advanced-search operator string), queryType ("Latest" | "Top")
// Billing: ~$0.00015 per tweet returned (pay-per-use, no monthly minimum).

const BASE_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search";

/**
 * Run an advanced search query against TwitterAPI.io.
 * @param {string} query - full operator string, e.g. `"looking for someone to build" -is:retweet`
 * @param {string} apiKey - user's TwitterAPI.io API key
 * @param {object} [opts]
 * @param {string} [opts.queryType="Latest"] - "Latest" or "Top"
 * @param {string} [opts.cursor] - pagination cursor from a previous response
 * @returns {Promise<{tweets: Array, next_cursor: string|null, has_next_page: boolean}>}
 */
export async function advancedSearch(query, apiKey, opts = {}) {
  if (!apiKey) {
    throw new Error(
      "Missing TwitterAPI.io API key. Set TWITTERAPI_IO_KEY in your environment."
    );
  }

  const params = new URLSearchParams({
    query,
    queryType: opts.queryType || "Latest",
  });
  if (opts.cursor) params.set("cursor", opts.cursor);

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `TwitterAPI.io request failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = await res.json();

  // Normalize the shape we rely on elsewhere in the app. TwitterAPI.io
  // returns a `tweets` array with author, text, createdAt, likeCount, etc.
  const tweets = (data.tweets || []).map((t) => ({
    id: t.id,
    text: t.text,
    url: t.url || `https://x.com/${t.author?.userName}/status/${t.id}`,
    author: t.author?.userName || "unknown",
    authorName: t.author?.name || t.author?.userName || "unknown",
    createdAt: t.createdAt,
    likeCount: t.likeCount ?? 0,
    retweetCount: t.retweetCount ?? 0,
    replyCount: t.replyCount ?? 0,
  }));

  return {
    tweets,
    next_cursor: data.next_cursor || null,
    has_next_page: !!data.has_next_page,
  };
}

/**
 * Build a bounded advanced-search query string: base query + a since_time
 * operator so polling only pulls posts newer than the last check, plus a
 * retweet exclusion so the feed isn't full of reposts.
 * @param {string} baseQuery
 * @param {number|null} sinceUnixSeconds
 */
export function buildBoundedQuery(baseQuery, sinceUnixSeconds) {
  let q = baseQuery.trim();
  if (!/-is:retweet/.test(q)) q += " -is:retweet";
  if (sinceUnixSeconds) q += ` since_time:${sinceUnixSeconds}`;
  return q;
}
