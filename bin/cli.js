#!/usr/bin/env node
// ── bin/cli.js ────────────────────────────────────────────

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const C = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

const cmd = process.argv[2];

function run(c) {
  try {
    return execSync(c, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

// ── Help ──────────────────────────────────────────────────
function showHelp() {
  console.log(`
${C.bold}${C.cyan}  AI Senior Dev Reviewer${C.reset}
  Self-improving code reviewer for React & React Native

${C.bold}  Usage:${C.reset}
    ${C.green}ai-reviewer install${C.reset}      Install hook scoped to current sub-project
    ${C.green}ai-reviewer uninstall${C.reset}    Remove hook
    ${C.green}ai-reviewer review${C.reset}       Run manually on staged files
    ${C.green}ai-reviewer dashboard${C.reset}    Open review history dashboard
    ${C.green}ai-reviewer status${C.reset}       Show project status
    ${C.green}ai-reviewer help${C.reset}         Show this help

${C.bold}  Monorepo example:${C.reset}
    cd newmecode/nextjs  &&  ai-reviewer install
    cd newmecode/mobile  &&  ai-reviewer install
    cd newmecode/pos     &&  ai-reviewer install

    Each sub-project gets its own scoped hook + its own memory.

${C.bold}  Skip a review:${C.reset}
    git commit --no-verify
`);
}

// ── Status ────────────────────────────────────────────────
function showStatus() {
  const gitRoot = run("git rev-parse --show-toplevel");
  const projectDir = process.cwd();
  const projectName = path.basename(projectDir);

  if (!gitRoot) {
    console.log(`${C.red}✗  Not inside a git repository${C.reset}`);
    return;
  }

  const hookPath = path.join(gitRoot, ".git", "hooks", "pre-commit");
  const hookContent = fs.existsSync(hookPath)
    ? fs.readFileSync(hookPath, "utf8")
    : "";

  // Check hook is scoped to THIS sub-project
  const hookInstalled =
    hookContent.includes("AI Senior Dev Reviewer") &&
    hookContent.includes(projectDir);

  const patternsPath = path.join(projectDir, ".ai-reviewer", "patterns.json");
  let patterns = {};
  try {
    patterns = JSON.parse(fs.readFileSync(patternsPath, "utf8"));
  } catch {}

  // Load env to check API key
  const envPath = path.join(projectDir, ".env");
  let apiKeyInEnv = false;
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    apiKeyInEnv =
      envContent.includes("GEMINI_API_KEY") ||
      envContent.includes("ANTHROPIC_API_KEY") ||
      envContent.includes("OPENAI_API_KEY");
  }
  const apiKey = process.env.OPENAI_API_KEY || apiKeyInEnv;
  const model = process.env.AI_REVIEWER_MODEL || "gpt-4o-mini";

  console.log(`\n${C.bold}${C.cyan}  AI Reviewer — Project Status${C.reset}\n`);
  console.log(`  Sub-project:   ${C.bold}${projectName}${C.reset}`);
  console.log(`  Path:          ${C.dim}${projectDir}${C.reset}`);
  console.log(`  Git root:      ${C.dim}${gitRoot}${C.reset}`);
  console.log(
    `  Hook:          ${
      hookInstalled
        ? `${C.green}✓ installed (scoped to ${projectName})${C.reset}`
        : `${C.red}✗ not installed${C.reset} — run: ai-reviewer install`
    }`,
  );
  console.log(
    `  API key:       ${
      apiKey
        ? `${C.green}✓ set${C.reset}`
        : `${C.red}✗ missing${C.reset} — add GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY to ${projectName}/.env`
    }`,
  );
  console.log(
    `  .env:          ${
      fs.existsSync(envPath)
        ? `${C.green}✓ found${C.reset} (${envPath})`
        : `${C.yellow}✗ no .env found${C.reset}`
    }`,
  );
  console.log(`  Model:         ${C.cyan}${model}${C.reset}`);
  console.log(
    `  Reviews done:  ${C.bold}${patterns.total_commits_reviewed || 0}${C.reset}`,
  );
  console.log(
    `  Patterns:      ${C.bold}${patterns.recurring_issues?.length || 0}${C.reset} learned`,
  );

  if (patterns.team_blind_spots?.length) {
    console.log(
      `\n  ${C.yellow}${C.bold}Team blind spots for ${projectName}:${C.reset}`,
    );
    patterns.team_blind_spots.forEach((s, i) => {
      console.log(`  ${C.dim}${i + 1}.${C.reset} ${s}`);
    });
  }
  console.log("");
}

// ── Open dashboard ────────────────────────────────────────
function openDashboard() {
  require("./dashboard.js");
  const dashPath = path.join(process.cwd(), ".ai-reviewer", "dashboard.html");
  setTimeout(() => {
    if (fs.existsSync(dashPath)) {
      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      try {
        execSync(`${opener} "${dashPath}"`);
      } catch {
        console.log(`  Open manually: ${dashPath}`);
      }
    }
  }, 300);
}

// ── Route ─────────────────────────────────────────────────
switch (cmd) {
  case "install":
    require("./install.js");
    break;
  case "uninstall":
    require("./uninstall.js");
    break;
  case "review":
    require("../src/index.js");
    break;
  case "dashboard":
    openDashboard();
    break;
  case "status":
    showStatus();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    showHelp();
    break;
  default:
    console.log(`${C.red}Unknown command: ${cmd}${C.reset}`);
    showHelp();
    process.exit(1);
}
