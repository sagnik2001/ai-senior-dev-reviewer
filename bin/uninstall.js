#!/usr/bin/env node
// ── bin/uninstall.js ──────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const C = { green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", bold: "\x1b[1m", reset: "\x1b[0m" };

function run(cmd) {
  try { return execSync(cmd, { encoding: "utf8" }).trim(); } catch { return ""; }
}

const gitRoot = run("git rev-parse --show-toplevel");
if (!gitRoot) {
  console.error(`${C.red}✗  Not inside a git repository.${C.reset}`);
  process.exit(1);
}

const hookPath = path.join(gitRoot, ".git", "hooks", "pre-commit");
const backup   = hookPath + ".bak";

if (!fs.existsSync(hookPath)) {
  console.log(`${C.yellow}No pre-commit hook found — nothing to remove.${C.reset}`);
  process.exit(0);
}

const content = fs.readFileSync(hookPath, "utf8");
if (!content.includes("AI Senior Dev Reviewer")) {
  console.log(`${C.yellow}⚠  Pre-commit hook exists but was not installed by AI Reviewer.${C.reset}`);
  console.log(`   Remove it manually: ${hookPath}`);
  process.exit(0);
}

fs.unlinkSync(hookPath);

if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, hookPath);
  fs.chmodSync(hookPath, 0o755);
  fs.unlinkSync(backup);
  console.log(`${C.green}${C.bold}✓  Hook removed. Previous hook restored from backup.${C.reset}`);
} else {
  console.log(`${C.green}${C.bold}✓  AI Reviewer hook removed.${C.reset}`);
}
