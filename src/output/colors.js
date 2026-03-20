// ── output/colors.js ──────────────────────────────────────

const C = {
  red:     "\x1b[31m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  green:   "\x1b[32m",
  cyan:    "\x1b[36m",
  magenta: "\x1b[35m",
  white:   "\x1b[37m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  reset:   "\x1b[0m",
};

function colorLine(line) {
  if (line.includes("🔴 BLOCK"))        return `${C.red}${C.bold}${line}${C.reset}`;
  if (line.includes("🟡 WARN"))         return `${C.yellow}${C.bold}${line}${C.reset}`;
  if (line.includes("🔵 SUGGEST"))      return `${C.blue}${line}${C.reset}`;
  if (line.includes("⚪ STYLE"))         return `${C.dim}${line}${C.reset}`;
  if (/^(Problem|Risk|Fix):/.test(line)) return `${C.bold}${line}${C.reset}`;
  if (line.startsWith("```"))            return `${C.dim}${line}${C.reset}`;
  if (line.startsWith("//"))             return `${C.dim}${line}${C.reset}`;
  if (line.startsWith("PASS "))          return `\n${C.cyan}${C.bold}${line}${C.reset}`;
  return line;
}

function printDivider() {
  process.stdout.write(
    `${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`
  );
}

function printHeader(stagedCount, commitsReviewed, blindSpots) {
  process.stdout.write(`\n${C.bold}${C.cyan}`);
  process.stdout.write(`  ╔══════════════════════════════════════════╗\n`);
  process.stdout.write(`  ║       AI Senior Dev Reviewer             ║\n`);
  process.stdout.write(`  ╚══════════════════════════════════════════╝${C.reset}\n\n`);
  process.stdout.write(`  ${C.bold}Files staged:${C.reset}     ${stagedCount}\n`);
  process.stdout.write(`  ${C.bold}Reviews done:${C.reset}     ${commitsReviewed}\n`);

  if (blindSpots?.length) {
    process.stdout.write(
      `  ${C.bold}Known blind spots:${C.reset} ${C.yellow}${blindSpots.slice(0, 2).join(" · ")}${C.reset}\n`
    );
  }
  process.stdout.write("\n");
}

function printReview(review) {
  const clean = review
    .replace(/REVIEW_METADATA_START[\s\S]*?REVIEW_METADATA_END/, "")
    .trim();

  for (const line of clean.split("\n")) {
    process.stdout.write(colorLine(line) + "\n");
  }
}

function printVerdict(hasBlockers, topIssue, updatedPatterns) {
  process.stdout.write("\n");
  if (hasBlockers) {
    process.stdout.write(`${C.red}${C.bold}  ✗  Commit BLOCKED${C.reset}\n`);
    process.stdout.write(`${C.red}     Fix all 🔴 BLOCK issues above, then recommit.${C.reset}\n`);
    if (topIssue) {
      process.stdout.write(`${C.red}     Most critical: ${topIssue}${C.reset}\n`);
    }
    process.stdout.write(
      `${C.dim}     To skip (use sparingly): git commit --no-verify${C.reset}\n`
    );
  } else {
    process.stdout.write(`${C.green}${C.bold}  ✓  Commit allowed${C.reset}\n`);
    if (topIssue) {
      process.stdout.write(`${C.yellow}     Suggestion: ${topIssue}${C.reset}\n`);
    }
  }

  const count = updatedPatterns.total_commits_reviewed || 0;
  const learned = updatedPatterns.recurring_issues?.length || 0;
  process.stdout.write(
    `\n${C.dim}  Reviews: ${count}  |  Patterns learned: ${learned}  |  run \`npm run dashboard\` to see history${C.reset}\n\n`
  );
}

module.exports = { C, colorLine, printDivider, printHeader, printReview, printVerdict };
