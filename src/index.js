const config = require("./config");
const { bootstrap, loadPatterns, updateMemory } = require("./memory");
const { getStagedFiles, getStagedDiff, buildCodebaseSnapshot, getGitInfo } = require("./analyzer/git");
const { buildPrompt } = require("./analyzer/prompt");
const { callAI, parseMetadata } = require("./analyzer/api");
const { printDivider, printHeader, printReview, printVerdict, C } = require("./output/colors");

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const hasKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY    ||
    process.env.OPENAI_API_KEY;

  if (!hasKey) {
    process.stderr.write(
      `${C.yellow}⚠  No API key found — add to .env:\n` +
      `   ANTHROPIC_API_KEY=...  (recommended, $5 free)\n` +
      `   GEMINI_API_KEY=...     (free tier)\n` +
      `   OPENAI_API_KEY=...     (paid)${C.reset}\n`
    );
    process.exit(0);
  }

  bootstrap();

  const stagedFiles = getStagedFiles();
  if (!stagedFiles.length) {
    if (config.verbose) process.stdout.write("No React/RN files staged — skipping.\n");
    process.exit(0);
  }

  if (isDryRun) {
    process.stdout.write(`${C.cyan}[dry-run] Would review: ${stagedFiles.join(", ")}${C.reset}\n`);
    process.exit(0);
  }

  const diff = getStagedDiff(stagedFiles);
  if (!diff) {
    if (config.verbose) process.stdout.write("Empty diff — skipping.\n");
    process.exit(0);
  }

  const patterns = loadPatterns();
  const gitInfo  = getGitInfo();

  printHeader(stagedFiles.length, patterns.total_commits_reviewed, patterns.team_blind_spots);

  if (config.verbose) {
    process.stdout.write(`  Branch: ${gitInfo.branch}  |  Author: ${gitInfo.author}\n\n`);
  }

  process.stdout.write(`  Building codebase snapshot...\n`);
  const codebaseSnapshot = buildCodebaseSnapshot(stagedFiles);

  const provider =
    process.env.ANTHROPIC_API_KEY ? "Anthropic" :
    process.env.GEMINI_API_KEY    ? "Gemini"    : "OpenAI";
  process.stdout.write(`  Sending to ${provider}...\n\n`);

  let review;
  try {
    const prompt = buildPrompt({ diff, codebaseSnapshot, patterns });
    review = await callAI(prompt);
  } catch (err) {
    process.stderr.write(`${C.yellow}⚠  ${err.message} — skipping review${C.reset}\n`);
    process.exit(0);
  }

  if (!review) {
    process.stderr.write(`${C.yellow}⚠  Empty response — skipping review${C.reset}\n`);
    process.exit(0);
  }

  printDivider();
  if (review.includes("LGTM")) {
    process.stdout.write(`${C.green}${C.bold}  ✓  LGTM — no issues found${C.reset}\n`);
  } else {
    printReview(review);
  }
  printDivider();

  const metadata        = parseMetadata(review);
  const updatedPatterns = updateMemory(metadata, stagedFiles);
  printVerdict(metadata.has_blockers, metadata.top_issue, updatedPatterns);

  process.exit(metadata.has_blockers ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`${C.red}AI reviewer error: ${err.message}${C.reset}\n`);
  process.exit(0);
});
