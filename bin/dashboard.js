// ── bin/dashboard.js ──────────────────────────────────────
// Generates a beautiful HTML dashboard from review history.

const fs = require("fs");
const path = require("path");
const { readLog, loadPatterns } = require("../src/memory");
const config = require("../src/config");

function generateDashboard() {
  const log = readLog();
  const patterns = loadPatterns();

  if (!log.length) {
    console.log("No reviews yet. Make a commit first!");
    return;
  }

  const totalReviews = patterns.total_commits_reviewed || 0;
  const blockedCount = log.filter((l) => l.had_blockers).length;
  const blockRate = totalReviews ? Math.round((blockedCount / totalReviews) * 100) : 0;

  // Category frequency
  const catFreq = {};
  for (const entry of log) {
    for (const cat of entry.categories || []) {
      catFreq[cat] = (catFreq[cat] || 0) + 1;
    }
  }

  const topCategories = Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Recent reviews (last 20)
  const recent = [...log].reverse().slice(0, 20);

  // Trend data — commits per day with blocker flag
  const byDay = {};
  for (const entry of log) {
    const day = entry.timestamp?.slice(0, 10) || "unknown";
    if (!byDay[day]) byDay[day] = { total: 0, blocked: 0 };
    byDay[day].total++;
    if (entry.had_blockers) byDay[day].blocked++;
  }

  const trendDays = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14);

  const blindSpots = patterns.team_blind_spots || [];
  const learnedCount = patterns.recurring_issues?.length || 0;

  const catColors = {
    SECURITY:  "#FF4757",
    CRASH:     "#FF6B35",
    ANR:       "#FF9F43",
    "NON-FATAL":"#FFC312",
    PERF:      "#7B68EE",
    SUGGEST:   "#3D9BE9",
    DUPLICATE: "#2ED573",
    STYLE:     "#A4B0BE",
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Senior Dev Reviewer — Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;800&display=swap');

  :root {
    --bg:       #0D0F14;
    --surface:  #151820;
    --surface2: #1C2030;
    --border:   #252A3A;
    --text:     #E8EAF0;
    --muted:    #5A6080;
    --accent:   #4F6EF7;
    --green:    #2ED573;
    --red:      #FF4757;
    --yellow:   #FFC312;
    --mono:     'JetBrains Mono', monospace;
    --sans:     'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    min-height: 100vh;
    padding: 40px 24px;
  }

  .page { max-width: 1100px; margin: 0 auto; }

  /* Header */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }
  .logo-mark {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  h1 {
    font-size: 36px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -1px;
  }
  h1 span { color: var(--accent); }
  .subtitle {
    margin-top: 8px;
    color: var(--muted);
    font-size: 14px;
    font-family: var(--mono);
  }
  .last-run {
    text-align: right;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }
  .live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    background: var(--green);
    border-radius: 50%;
    margin-right: 6px;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Stat cards */
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 20px;
    position: relative;
    overflow: hidden;
  }
  .stat::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--accent-color, var(--accent));
  }
  .stat-label {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .stat-value {
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
    color: var(--accent-color, var(--text));
  }
  .stat-sub {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    margin-top: 6px;
  }

  /* Grid layout */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
  }
  .card-title {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  /* Bar chart */
  .bar-chart { display: flex; flex-direction: column; gap: 10px; }
  .bar-row { display: flex; align-items: center; gap: 12px; }
  .bar-label {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    width: 90px;
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 8px;
    background: var(--surface2);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.8s ease;
  }
  .bar-count {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    width: 24px;
    text-align: right;
  }

  /* Trend chart */
  .trend-chart {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 80px;
    padding-top: 8px;
  }
  .trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .trend-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 2px; }
  .trend-day {
    font-family: var(--mono);
    font-size: 8px;
    color: var(--muted);
    margin-top: 4px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
  }

  /* Blind spots */
  .blind-spots { display: flex; flex-direction: column; gap: 8px; }
  .blind-spot {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface2);
    border-radius: 8px;
    border-left: 3px solid var(--red);
  }
  .blind-spot-num {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--red);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .blind-spot-text {
    font-size: 12px;
    color: var(--text);
    line-height: 1.4;
  }

  /* Recent log */
  .log-table { width: 100%; border-collapse: collapse; }
  .log-table th {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: left;
    padding: 0 12px 12px;
    border-bottom: 1px solid var(--border);
  }
  .log-table td {
    padding: 10px 12px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .log-table tr:last-child td { border-bottom: none; }
  .log-table tr:hover td { background: var(--surface2); }
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }
  .blocked { background: rgba(255,71,87,0.15); color: var(--red); }
  .allowed { background: rgba(46,213,115,0.15); color: var(--green); }
  .issue-text { color: var(--text); max-width: 300px; }
  .cat-pill {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    margin: 1px;
    font-weight: 600;
  }

  /* Footer */
  .footer {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .footer-cmd {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--surface2);
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="logo-mark">AI Senior Dev Reviewer</div>
      <h1>Review <span>Dashboard</span></h1>
      <div class="subtitle">Self-improving · ${learnedCount} patterns learned</div>
    </div>
    <div class="last-run">
      <div><span class="live-dot"></span>Active</div>
      <div style="margin-top:4px">Generated ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat" style="--accent-color: var(--accent)">
      <div class="stat-label">Total reviews</div>
      <div class="stat-value">${totalReviews}</div>
      <div class="stat-sub">commits reviewed</div>
    </div>
    <div class="stat" style="--accent-color: var(--red)">
      <div class="stat-label">Blocked</div>
      <div class="stat-value">${blockedCount}</div>
      <div class="stat-sub">${blockRate}% block rate</div>
    </div>
    <div class="stat" style="--accent-color: var(--yellow)">
      <div class="stat-label">Patterns learned</div>
      <div class="stat-value">${learnedCount}</div>
      <div class="stat-sub">recurring issues tracked</div>
    </div>
    <div class="stat" style="--accent-color: var(--green)">
      <div class="stat-label">Clean commits</div>
      <div class="stat-value">${totalReviews - blockedCount}</div>
      <div class="stat-sub">passed without blockers</div>
    </div>
  </div>

  <div class="grid-3">
    <!-- Issue frequency -->
    <div class="card">
      <div class="card-title">Issue categories — all time</div>
      <div class="bar-chart">
        ${topCategories.map(([cat, count]) => {
          const pct = Math.round((count / totalReviews) * 100);
          const col = catColors[cat] || "#5A6080";
          return `<div class="bar-row">
            <span class="bar-label">${cat}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:${col}"></div>
            </div>
            <span class="bar-count">${count}</span>
          </div>`;
        }).join("")}
        ${topCategories.length === 0 ? '<div style="color:var(--muted);font-family:var(--mono);font-size:12px">No data yet</div>' : ""}
      </div>
    </div>

    <!-- Blind spots -->
    <div class="card">
      <div class="card-title">Team blind spots</div>
      <div class="blind-spots">
        ${blindSpots.length
          ? blindSpots.map((s, i) => `
            <div class="blind-spot">
              <span class="blind-spot-num">${String(i + 1).padStart(2, "0")}</span>
              <span class="blind-spot-text">${s}</span>
            </div>`).join("")
          : '<div style="color:var(--muted);font-family:var(--mono);font-size:12px">Still learning — make more commits</div>'
        }
      </div>
    </div>
  </div>

  <!-- Commit trend -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Commit trend — last 14 days</div>
    <div class="trend-chart">
      ${trendDays.map(([day, data]) => {
        const maxTotal = Math.max(...trendDays.map(([, d]) => d.total), 1);
        const heightPct = Math.round((data.total / maxTotal) * 100);
        const col = data.blocked > 0 ? "var(--red)" : "var(--accent)";
        const label = day.slice(5); // MM-DD
        return `<div class="trend-col">
          <div class="trend-bar" style="height:${heightPct}%;background:${col}" title="${day}: ${data.total} reviews, ${data.blocked} blocked"></div>
          <span class="trend-day">${label}</span>
        </div>`;
      }).join("")}
      ${trendDays.length === 0 ? '<div style="color:var(--muted);font-family:var(--mono);font-size:12px;padding:20px">No data yet</div>' : ""}
    </div>
    <div style="margin-top:12px;display:flex;gap:16px;font-family:var(--mono);font-size:10px;color:var(--muted)">
      <span><span style="display:inline-block;width:8px;height:8px;background:var(--accent);border-radius:2px;margin-right:4px"></span>Clean</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:2px;margin-right:4px"></span>Blocked</span>
    </div>
  </div>

  <!-- Recent reviews -->
  <div class="card">
    <div class="card-title">Recent reviews</div>
    <table class="log-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Status</th>
          <th>Categories</th>
          <th>Top issue</th>
          <th>Files</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map((entry) => {
          const time = entry.timestamp
            ? new Date(entry.timestamp).toLocaleString()
            : "—";
          const cats = (entry.categories || [])
            .map((c) => `<span class="cat-pill" style="background:${(catColors[c] || "#5A6080")}22;color:${catColors[c] || "#5A6080"}">${c}</span>`)
            .join("");
          const files = Array.isArray(entry.files) ? entry.files.length : "—";
          return `<tr>
            <td>${time}</td>
            <td><span class="status-badge ${entry.had_blockers ? "blocked" : "allowed"}">${entry.had_blockers ? "BLOCKED" : "ALLOWED"}</span></td>
            <td>${cats || "—"}</td>
            <td class="issue-text">${entry.top_issue || "—"}</td>
            <td>${files}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="footer-left">AI Senior Dev Reviewer · self-improving since first commit</div>
    <div class="footer-cmd">npm run dashboard</div>
  </div>

</div>
</body>
</html>`;

  const outPath = config.dashboardFile;
  fs.writeFileSync(outPath, html, "utf8");

  console.log(`\n  Dashboard generated: ${outPath}`);
  console.log(`  Open in browser: open ${outPath}\n`);
}

generateDashboard();
