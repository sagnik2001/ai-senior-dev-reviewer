// ── config.js ─────────────────────────────────────────────
// Finds .env relative to the git root of whichever sub-project
// you're currently in. Works in monorepos:
//
//   newmecode/nextjs/   → loads newmecode/nextjs/.env
//   newmecode/mobile/   → loads newmecode/mobile/.env
//   newmecode/pos/      → loads newmecode/pos/.env

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Find the nearest .env walking up from cwd ─────────────
function findEnvFile() {
  // First try: git root of the immediate repo/sub-project
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const envAtGitRoot = path.join(gitRoot, ".env");
    if (fs.existsSync(envAtGitRoot)) return envAtGitRoot;
  } catch {
    // not a git repo — fall through to cwd walk
  }

  // Second try: walk up from cwd looking for .env
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

// ── Parse and load .env file ──────────────────────────────
function loadEnv() {
  const envPath = findEnvFile();
  if (!envPath) return;

  const lines = fs.readFileSync(envPath, "utf8").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key   = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  if (process.env.AI_REVIEWER_VERBOSE === "true") {
    process.stderr.write(`  [ai-reviewer] loaded env: ${envPath}\n`);
  }
}

loadEnv();

module.exports = {
 model: process.env.AI_REVIEWER_MODEL || "gemini-1.5-flash",
apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",

  reviewerDir:   ".ai-reviewer",
  patternsFile:  ".ai-reviewer/patterns.json",
  contextFile:   ".ai-reviewer/codebase-context.json",
  logFile:       ".ai-reviewer/review-log.jsonl",
  dashboardFile: ".ai-reviewer/dashboard.html",

  maxContextLines:  60,
  maxDiffChars:     14000,
  maxSnapshotFiles: 80,

  extensions:     [".tsx", ".jsx", ".ts", ".js"],
  srcDirs:        ["src", "app", "components", "screens", "hooks", "utils", "lib", "features", "pages","containers"],
  ignorePatterns: ["__tests__", ".test.", ".spec.", "node_modules", ".min.", "dist/", "build/", ".d.ts"],

  maxRecurringIssues: 50,
  maxBlindSpots:      10,

  verbose: process.env.AI_REVIEWER_VERBOSE === "true",
};