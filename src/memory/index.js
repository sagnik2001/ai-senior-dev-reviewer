const fs = require("fs");
const path = require("path");
const config = require("../config");

const DEFAULT_PATTERNS = {
  version: 2,
  total_commits_reviewed: 0,
  recurring_issues: [],
  team_blind_spots: [],
  security_patterns_found: [],
  crash_patterns_found: [],
  last_reviewed: null,
};

const DEFAULT_CONTEXT = {
  components: [],
  custom_hooks: [],
  utilities: [],
  last_updated: null,
};

function bootstrap() {
  if (!fs.existsSync(config.reviewerDir)) fs.mkdirSync(config.reviewerDir, { recursive: true });
  if (!fs.existsSync(config.patternsFile)) writeJSON(config.patternsFile, DEFAULT_PATTERNS);
  if (!fs.existsSync(config.contextFile))  writeJSON(config.contextFile, DEFAULT_CONTEXT);
}

function readJSON(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return fallback; }
}

function writeJSON(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8"); }
  catch {}
}

function appendLine(filePath, obj) {
  try { fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8"); }
  catch {}
}

function loadPatterns() {
  return readJSON(config.patternsFile, DEFAULT_PATTERNS);
}

function updateMemory(metadata, stagedFiles) {
  const patterns = loadPatterns();
  patterns.total_commits_reviewed = (patterns.total_commits_reviewed || 0) + 1;
  patterns.last_reviewed = new Date().toISOString();

  if (Array.isArray(metadata.new_patterns_found)) {
    const merged = [...new Set([
      ...(patterns.recurring_issues || []),
      ...metadata.new_patterns_found.filter(Boolean),
    ])];
    patterns.recurring_issues = merged.slice(-config.maxRecurringIssues);
    patterns.team_blind_spots = merged.slice(-config.maxBlindSpots);
  }

  if (Array.isArray(metadata.categories_flagged)) {
    if (metadata.categories_flagged.includes("SECURITY")) {
      patterns.security_patterns_found = [
        ...(patterns.security_patterns_found || []),
        { date: new Date().toISOString(), issue: metadata.top_issue },
      ].slice(-20);
    }
    if (metadata.categories_flagged.some(c => ["CRASH","ANR","NON-FATAL"].includes(c))) {
      patterns.crash_patterns_found = [
        ...(patterns.crash_patterns_found || []),
        { date: new Date().toISOString(), issue: metadata.top_issue },
      ].slice(-20);
    }
  }

  writeJSON(config.patternsFile, patterns);

  const ctx = readJSON(config.contextFile, DEFAULT_CONTEXT);
  ctx.last_updated = new Date().toISOString();
  writeJSON(config.contextFile, ctx);

  appendLine(config.logFile, {
    timestamp: new Date().toISOString(),
    files: stagedFiles,
    had_blockers: metadata.has_blockers || false,
    categories: metadata.categories_flagged || [],
    top_issue: metadata.top_issue || "",
    commit_count: patterns.total_commits_reviewed,
  });

  return patterns;
}

function readLog() {
  try {
    return fs.readFileSync(config.logFile, "utf8")
      .split("\n").filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

module.exports = { bootstrap, loadPatterns, updateMemory, readLog, readJSON, writeJSON };
