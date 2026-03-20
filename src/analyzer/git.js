// ── analyzer/git.js ───────────────────────────────────────

const { execSync } = require("child_process");
const fs   = require("fs");
const path = require("path");
const config = require("../config");

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

// ── Git roots ─────────────────────────────────────────────
function getGitRoot() {
  return run("git rev-parse --show-toplevel");
}

// Relative path from git root to cwd
// e.g. cwd = /newmecode/nextjs, gitRoot = /newmecode → "nextjs"
function getSubProjectPrefix() {
  const gitRoot    = getGitRoot();
  const cwd        = process.cwd();
  if (!gitRoot || cwd === gitRoot) return "";
  const rel = path.relative(gitRoot, cwd);
  return rel; // e.g. "nextjs" or "mobile"
}

// ── Staged files ──────────────────────────────────────────
function getStagedFiles() {
  const raw = run("git diff --cached --name-only --diff-filter=ACM");
  if (!raw) return [];

  const gitRoot = getGitRoot();
  const prefix  = path.relative(gitRoot, process.cwd()); // e.g. "nextjs"

  return raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !prefix || f.startsWith(prefix + "/"))
    .map((f) => prefix ? f.slice(prefix.length + 1) : f)
    .filter((f) => config.extensions.some((ext) => f.endsWith(ext)))
    .filter((f) => !config.ignorePatterns.some((p) => f.includes(p)));
}

// ── Diff ──────────────────────────────────────────────────
function getStagedDiff(files) {
  if (!files.length) return "";

  const gitRoot  = getGitRoot();
  const prefix   = path.relative(gitRoot, process.cwd());

  // Build absolute paths then make relative to git root
  const gitPaths = files.map((f) => {
    const abs = path.join(process.cwd(), f);
    return path.relative(gitRoot, abs);
  });

  // Run git diff from the git root, not cwd
  let diff;
  try {
    diff = execSync(
      `git diff --cached -- ${gitPaths.map(p => `"${p}"`).join(" ")}`,
      {
        encoding: "utf8",
        cwd: gitRoot,   // <-- run from git root, not cwd
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();
  } catch {
    diff = "";
  }

  if (diff.length > config.maxDiffChars) {
    diff = diff.slice(0, config.maxDiffChars) + "\n\n... [diff truncated]";
  }

  return diff;
}

// ── Codebase snapshot for duplicate detection ─────────────
function buildCodebaseSnapshot(stagedFiles) {
  const stagedSet  = new Set(stagedFiles);
  const snapshot   = [];
  let   fileCount  = 0;

  // Also scan "containers" and other common dirs
  const dirsToScan = [
    ...config.srcDirs,
    "containers", "container", "pages", "views",
  ];

  for (const dir of [...new Set(dirsToScan)]) {
    if (!fs.existsSync(dir)) continue;

    const files = walkDir(dir).filter(
      (f) =>
        config.extensions.some((ext) => f.endsWith(ext)) &&
        !config.ignorePatterns.some((p) => f.includes(p)) &&
        !stagedSet.has(f)
    );

    for (const file of files) {
      if (fileCount >= config.maxSnapshotFiles) break;
      try {
        const lines = fs
          .readFileSync(file, "utf8")
          .split("\n")
          .slice(0, config.maxContextLines)
          .join("\n");
        snapshot.push(`=== EXISTING: ${file} ===\n${lines}\n`);
        fileCount++;
      } catch {
        // skip unreadable
      }
    }
  }

  return snapshot.join("\n");
}

function walkDir(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        results.push(...walkDir(full));
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  } catch {
    // skip
  }
  return results;
}

// ── Git info ──────────────────────────────────────────────
function getGitInfo() {
  return {
    branch: run("git rev-parse --abbrev-ref HEAD") || "unknown",
    author: run("git config user.name") || "unknown",
  };
}

module.exports = {
  getStagedFiles,
  getStagedDiff,
  buildCodebaseSnapshot,
  getGitInfo,
};