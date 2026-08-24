"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const POLL_INTERVAL_OPTIONS = [
  { label: "2 min", value: 2 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "30 min", value: 30 },
];

export default function Home() {
  const [searches, setSearches] = useState([]);
  const [feed, setFeed] = useState([]);
  const [mode, setMode] = useState("nl");
  const [label, setLabel] = useState("");
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [intervalMin, setIntervalMin] = useState(5);
  const [lastChecked, setLastChecked] = useState(null);
  const [seenAt, setSeenAt] = useState(() => Date.now());

  const timerRef = useRef(null);

  const loadSearches = useCallback(async () => {
    const res = await fetch("/api/searches");
    const data = await res.json();
    setSearches(data.searches || []);
  }, []);

  const loadFeed = useCallback(async () => {
    const res = await fetch("/api/feed");
    const data = await res.json();
    setFeed(data.feed || []);
  }, []);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      await fetch("/api/poll", { method: "POST" });
      await Promise.all([loadFeed(), loadSearches()]);
      setLastChecked(new Date());
    } finally {
      setChecking(false);
    }
  }, [loadFeed, loadSearches]);

  useEffect(() => {
    loadSearches();
    loadFeed();
  }, [loadSearches, loadFeed]);

  // Client-side polling while the tab is open, on top of whatever the
  // optional Netlify scheduled function does in the background.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(checkNow, intervalMin * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, [intervalMin, checkNow]);

  async function addSearch(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, mode, input }),
      });
      if (res.ok) {
        setLabel("");
        setInput("");
        await loadSearches();
      } else {
        const err = await res.json();
        alert(err.error || "Couldn't add that search.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(s) {
    await fetch("/api/searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    loadSearches();
  }

  async function removeSearch(id) {
    await fetch("/api/searches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSearches();
  }

  return (
    <div className="station">
      <header className="scanner-header">
        <div className="brand">
          <span className="brand-mark">ZK</span>
          <div>
            <div className="brand-name">ZEKE SPACE</div>
            <div className="brand-tagline">
              A listening station for X — surfaces the ask, you make the call.
            </div>
          </div>
        </div>
        <div className="status-pill">
          <span className={`status-dot ${checking ? "" : "idle"}`} />
          {checking
            ? "scanning…"
            : lastChecked
            ? `last check ${lastChecked.toLocaleTimeString()}`
            : "idle"}
        </div>
      </header>

      <aside className="sidebar">
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            New search
          </div>
          <form onSubmit={addSearch} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="mode-toggle">
              <button type="button" className={mode === "nl" ? "active" : ""} onClick={() => setMode("nl")}>
                natural language
              </button>
              <button type="button" className={mode === "keyword" ? "active" : ""} onClick={() => setMode("keyword")}>
                keyword / operators
              </button>
            </div>

            <div className="field">
              <label>Label (optional)</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. AI UGC leads" />
            </div>

            <div className="field">
              <label>{mode === "nl" ? "Describe who you're looking for" : "Query / operators"}</label>
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "nl"
                    ? "people looking for someone to build a custom AI workflow"
                    : '"need an AI video" OR "AI UGC" -is:retweet'
                }
              />
            </div>

            <button type="submit" className="btn primary" disabled={adding}>
              {adding ? "adding…" : "+ add search"}
            </button>
          </form>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Active searches ({searches.length})
          </div>
          <div className="search-list">
            {searches.length === 0 && (
              <div className="help-text">No searches yet — add one above to start scanning.</div>
            )}
            {searches.map((s) => (
              <div key={s.id} className={`search-card ${s.active ? "" : "paused"}`}>
                <div className="search-card-top">
                  <div>
                    <div className="search-label">{s.label}</div>
                    <div className="search-meta">
                      {s.mode} · {s.lastCheckedAt ? `checked ${new Date(s.lastCheckedAt).toLocaleTimeString()}` : "not checked yet"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" onClick={() => toggleActive(s)} title={s.active ? "Pause" : "Resume"}>
                      {s.active ? "⏸" : "▶"}
                    </button>
                    <button className="icon-btn" onClick={() => removeSearch(s.id)} title="Delete">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Scan interval
          </div>
          <select value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))}>
            {POLL_INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                every {o.label}
              </option>
            ))}
          </select>
          <div className="help-text" style={{ marginTop: 8 }}>
            Auto-checks while this tab is open. The optional scheduled function keeps checking in the background too — see README.
          </div>
        </div>

        <button className="btn" onClick={checkNow} disabled={checking}>
          {checking ? "scanning…" : "check now"}
        </button>
      </aside>

      <main className="feed-area">
        <div className="feed-toolbar">
          <div className="feed-title">FEED · {feed.length} matched posts</div>
        </div>

        {feed.length === 0 ? (
          <div className="feed-empty">
            No matches yet. Add a search on the left, then hit "check now" — new
            posts will show up here as they're found, oldest reviewed first.
          </div>
        ) : (
          <div className="feed-list">
            {feed.map((p) => (
              <article key={p.id} className={`post-card ${new Date(p.createdAt).getTime() > seenAt - 3600000 ? "fresh" : ""}`}>
                <div className="post-top">
                  <span>
                    <span className="post-author">@{p.author}</span>{" "}
                    · {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="badge tag">{p.matchedSearch}</span>
                    {new Date(p.createdAt).getTime() > seenAt - 3600000 && <span className="badge">NEW</span>}
                  </span>
                </div>
                <p className="post-text">{p.text}</p>
                <div className="post-stats">
                  <span>♥ {p.likeCount}</span>
                  <span>↻ {p.retweetCount}</span>
                  <span>💬 {p.replyCount}</span>
                  <a className="post-link" href={p.url} target="_blank" rel="noreferrer">
                    view on X →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
