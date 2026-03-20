#!/usr/bin/env node
// ── bin/install.js ────────────────────────────────────────
// Installs the pre-commit hook scoped to the sub-project
// you're currently in — not the monorepo root.
//
//   cd newmecode/nextjs  → hook scoped to nextjs/
//   cd newmecode/mobile  → hook scoped to mobile/
//   cd newmecode/pos     → hook scoped to pos/

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const C = {
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  reset:  "\x1b[0m",
};

function run(cmd) {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["pipe","pipe","pipe"] }).trim(); }
  catch { return ""; }
}

// ── Find the monorepo root (.git lives here) ──────────────
const gitRoot = run("git rev-parse --show-toplevel");
if (!gitRoot) {
  console.error(`${C.red}✗  Not inside a git repository.${C.reset}`);
  process.exit(1);
}

// ── Current sub-project dir (where you ran the command) ───
const projectDir  = process.cwd();
const projectName = path.basename(projectDir);

// ── Hook lives at the git root (git requires this) ────────
const hooksDir = path.join(gitRoot, ".git", "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

// ── Backup existing hook ──────────────────────────────────
if (fs.existsSync(hookPath)) {
  const backup = hookPath + ".bak";
  fs.copyFileSync(hookPath, backup);
  console.log(`${C.yellow}⚠  Existing hook backed up → .git/hooks/pre-commit.bak${C.reset}`);
}

// ── Reviewer entry point (absolute path) ─────────────────
const reviewerPath = path.resolve(__dirname, "..", "src", "index.js");

// ── Write the hook ────────────────────────────────────────
// The hook checks if the commit is being made from within
// the registered sub-project dir. If not, it skips silently.
// This means you can have different sub-projects each with
// their own scoped hook config without conflicts.
const hookContent = `#!/bin/sh
# AI Senior Dev Reviewer — scoped to: ${projectName}
# Installed from: ${projectDir}
# To skip: git commit --no-verify

# Only run when committing from within this sub-project
CURRENT_DIR=$(pwd)
PROJECT_DIR="${projectDir}"

if echo "$CURRENT_DIR" | grep -q "^$PROJECT_DIR"; then
  node "${reviewerPath}" "$@"
else
  # Different sub-project — skip silently
  exit 0
fi
`;

fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });

// ── Bootstrap .ai-reviewer/ inside the sub-project ───────
const reviewerDir = path.join(projectDir, ".ai-reviewer");
if (!fs.existsSync(reviewerDir)) {
  fs.mkdirSync(reviewerDir, { recursive: true });
}

const patternsPath = path.join(reviewerDir, "patterns.json");
if (!fs.existsSync(patternsPath)) {
  fs.writeFileSync(patternsPath, JSON.stringify({
    version: 2,
    project: projectName,
    total_commits_reviewed: 0,
    recurring_issues: [],
    team_blind_spots: [],
    security_patterns_found: [],
    crash_patterns_found: [],
    last_reviewed: null,
  }, null, 2));
}

// ── Done ──────────────────────────────────────────────────
console.log(`\n${C.green}${C.bold}  ✓  AI Reviewer installed for: ${projectName}${C.reset}\n`);
console.log(`  Sub-project:  ${projectDir}`);
console.log(`  Git root:     ${gitRoot}`);
console.log(`  Hook:         ${hookPath}`);
console.log(`  Memory:       ${reviewerDir}\n`);
console.log(`  ${C.cyan}Make sure ${projectName}/.env contains OPENAI_API_KEY${C.reset}\n`);
console.log(`  ${C.bold}Commands:${C.reset}`);
console.log(`    ai-reviewer status     — verify everything is set up`);
console.log(`    ai-reviewer review     — run manually on staged files`);
console.log(`    ai-reviewer dashboard  — open review history`);
console.log(`    git commit --no-verify — skip for one commit\n`);