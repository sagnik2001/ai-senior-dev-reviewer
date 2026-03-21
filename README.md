<div align="center">

# 🔍 AI Senior Dev Reviewer

**The AI code reviewer that thinks like a senior React Native & Next.js engineer.**

Runs on every `git commit`. Catches crashes, ANRs, hydration errors, security holes, and bad patterns before they hit production. Gets smarter with every commit by learning your team's specific blind spots.

[![npm version](https://img.shields.io/npm/v/ai-commit-reviewer.svg)](https://www.npmjs.com/package/ai-commit-reviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Installation](#installation) · [What it catches](#what-it-catches) · [Self-improving memory](#self-improving-memory) · [Commands](#commands) · [Config](#configuration) · [vs other tools](#why-not-just-use-copilot)

</div>

---

## The problem

You write code. You commit. You push. A senior dev reviews your PR two days later and finds a null dereference crash, a hardcoded API key, and a component that already exists in the codebase.

**That feedback loop is too slow and too late.**

AI Senior Dev Reviewer runs at `git commit` — before the code ever leaves your machine. It blocks the commit if it finds something serious, and explains exactly how to fix it.

```
git commit -m "payment success revamp"

  ╔══════════════════════════════════════════╗
  ║       AI Senior Dev Reviewer             ║
  ╚══════════════════════════════════════════╝

  Files staged:     1
  Reviews done:     24
  Known blind spots: missing useCallback on handlers · AsyncStorage for tokens

  Building codebase snapshot...
  Sending to AI...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS 1 — SECURITY

🔴 BLOCK [SECURITY] containers/Payment/index.tsx:42
Problem: Auth token stored in AsyncStorage — unencrypted plaintext on disk
Risk: Device theft or backup extraction exposes the token permanently
Fix:
  // Before
  await AsyncStorage.setItem('token', userToken)

  // After
  import * as Keychain from 'react-native-keychain'
  await Keychain.setGenericPassword('token', userToken)

PASS 2 — CRASHES

🔴 BLOCK [CRASH] containers/Payment/index.tsx:87
Problem: route.params.orderId accessed without existence check
Risk: Navigating to this screen without params crashes the app instantly
Fix:
  // Before
  const { orderId } = route.params

  // After
  const { orderId } = route.params ?? {}
  if (!orderId) return <ErrorScreen />

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✗  Commit BLOCKED — fix the 🔴 BLOCK issues above first
     Most critical: Auth token stored unencrypted in AsyncStorage
     To skip (use sparingly): git commit --no-verify
```

---

## What it catches

### 11 review passes on every commit

| Pass | Category | Examples |
|------|----------|---------|
| 1 | **Security** | Hardcoded secrets, unencrypted token storage, missing API auth, XSS, SQL injection |
| 2 | **Crashes** | Null deref, unhandled rejections, infinite loops, FlatList-in-ScrollView, number in `<Text>` |
| 3 | **ANRs & Perf** | JS thread blocking, multiple useMemos that could be one, O(n²) loops, no debounce |
| 4 | **Hydration** | Server/client mismatch, window in SSR, useLayoutEffect, invalid HTML nesting |
| 5 | **Next.js** | Missing auth on API routes, Server/Client misuse, redirect() in try/catch, missing Suspense |
| 6 | **Conventions** | Raw `<Text>` when team has `AppText`, raw fetch when team has API client, hardcoded colors |
| 7 | **Better code** | 40-line functions, nested ternaries, scattered `?.` instead of destructuring at top |
| 8 | **Duplicates** | Component already exists, util already in utils/, hook already extracted |
| 9 | **Non-fatals** | Race conditions, double form submit, stale closures, network errors swallowed |
| 10 | **Undeclared** | Variable used but never declared, prop not in interface, component never imported |
| 11 | **Style** | Vague names, magic numbers, dead code, missing boolean predicates |

### Framework-aware

Automatically detects which framework you're using and applies the right checks:

**React Native** — ANR risks, JS bridge overload, `useNativeDriver`, `FlatList` vs `ScrollView`, `Platform.OS` guards, permission checks, number/boolean inside `<Text>`, `react-native-keychain`, `react-native-fast-image`

**Next.js** — Hydration mismatches, Server vs Client component misuse, `redirect()` gotchas, `useSearchParams` without Suspense, missing `loading.tsx` / `error.tsx`, ISR revalidation, `next/image`, `next/font`

**React web** — Bundle splitting, virtualisation, error boundaries, SSR guards, `dangerouslySetInnerHTML`

### Codebase convention enforcement

The reviewer scans your existing codebase before every review and learns your team's standards:

- Has a custom `AppText` wrapper? → flags raw `<Text>` usage
- Has a custom `AppButton`? → flags raw `<TouchableOpacity>`
- Has `colors.ts` tokens? → flags hardcoded hex values
- Has `spacing.ts`? → flags magic numbers in StyleSheet
- Has an API client wrapper? → flags raw `fetch()` calls

It enforces **your team's conventions**, not generic ones.

### Wrong package detection

Using a React Native package in a Next.js file? It catches that too:

```
🟣 WRONG_PKG containers/Payment/index.tsx:3
Problem: react-native StyleSheet imported in a Next.js file
Risk: Will crash at runtime — StyleSheet does not exist in web React
```

---

## Self-improving memory

This is what makes it different from every other tool.

After every review, it writes to `.ai-reviewer/patterns.json` in your project:

```json
{
  "total_commits_reviewed": 47,
  "team_blind_spots": [
    "missing useCallback on handlers passed to memoized children",
    "AsyncStorage used for auth tokens instead of Keychain",
    "no optional chaining on navigation route.params",
    "inline style objects created in JSX instead of StyleSheet"
  ]
}
```

Every future review starts with: *"this team has historically gotten these things wrong — pay extra attention."*

After 10 commits it knows your codebase. After 50 it knows your team.

**Commit `patterns.json` to git** — the whole team shares the learned memory.

---

## Why not just use Copilot?

| | GitHub Copilot | CodeRabbit | ESLint | **This tool** |
|--|:-:|:-:|:-:|:-:|
| Blocks bad commits | ✗ | ✗ | ✗ | ✓ |
| React Native crash detection | ✗ | ✗ | ✗ | ✓ |
| ANR detection | ✗ | ✗ | ✗ | ✓ |
| Hydration error detection | ✗ | ✗ | ✗ | ✓ |
| Self-improving memory | ✗ | ✗ | ✗ | ✓ |
| Codebase convention enforcement | ✗ | ✗ | partial | ✓ |
| Wrong package detection | ✗ | ✗ | ✗ | ✓ |
| Duplicate component detection | ✗ | partial | ✗ | ✓ |
| Works at commit time | ✗ | ✗ (PR only) | ✓ | ✓ |
| Before/after code fixes | ✗ | partial | ✗ | ✓ |
| Zero infrastructure | ✓ | ✗ | ✓ | ✓ |
| Cost | $19/dev/mo | $19/dev/mo | free | ~$5 total |

**Copilot** helps you write code faster. This tool stops bad code reaching the repo.

**CodeRabbit** reviews PRs after bad code is already in the branch. This tool catches it before it's committed.

**ESLint** catches syntax and rule violations. This tool catches intent, logic bugs, and production failure patterns.

---

## Installation

### Requirements
- Node.js 16+
- Git
- An API key (OpenAI, Anthropic, or Google Gemini)

### Install from npm (recommended)

```bash
npm install -g ai-commit-reviewer
```

### Or clone and link

```bash
git clone https://github.com/sagnik2001/ai-senior-dev-reviewer.git ~/tools/ai-reviewer
cd ~/tools/ai-reviewer
npm link
```

### Per-project setup

```bash
# Go to your project
cd your-project

# Create .env with your API key (never commit this)
echo 'OPENAI_API_KEY=sk-proj-...' > .env
echo '.env' >> .gitignore

# Install the git hook
ai-reviewer install

# Verify everything is set up
ai-reviewer status
```

Done. The reviewer fires automatically on every `git commit`.

### Monorepo setup

Works perfectly in monorepos — each sub-project gets its own scoped hook and its own memory:

```bash
cd myrepo/nextjs  && ai-reviewer install
cd myrepo/mobile  && ai-reviewer install
cd myrepo/pos     && ai-reviewer install
```

---

## API keys

The tool supports three providers. Add one to your project's `.env`:

```bash
# Option 1 — OpenAI (most reliable)
OPENAI_API_KEY=sk-proj-...
AI_REVIEWER_MODEL=gpt-4o-mini    # ~$0.003/review

# Option 2 — Anthropic ($5 free credits)
ANTHROPIC_API_KEY=sk-ant-...
# uses claude-3-5-haiku by default

# Option 3 — Google Gemini (free tier available)
GEMINI_API_KEY=AIza...
# uses gemini-1.5-flash by default
```

Priority: **Anthropic → Gemini → OpenAI** (whichever key is present).

### Cost comparison

| Provider | Model | Cost per review | $5 buys you |
|----------|-------|----------------|-------------|
| OpenAI | gpt-4o-mini | ~$0.003 | ~1,600 reviews |
| OpenAI | gpt-4o | ~$0.04 | ~125 reviews |
| Anthropic | claude-3-5-haiku | ~$0.001 | ~5,000 reviews |
| Gemini | gemini-1.5-flash | free tier | free |

---

## Commands

```bash
ai-reviewer install      # install hook into current project
ai-reviewer uninstall    # remove hook (restores backup if exists)
ai-reviewer review       # run manually on staged files
ai-reviewer dashboard    # open HTML review history in browser
ai-reviewer status       # show hook status, API key, patterns learned
ai-reviewer help         # show all commands

# Skip review for one commit
git commit --no-verify
```

---

## Configuration

All settings can be overridden via environment variables or by editing `src/config.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `AI_REVIEWER_MODEL` | auto | Override the model (e.g. `gpt-4o`, `claude-3-5-haiku-20241022`) |
| `AI_REVIEWER_VERBOSE` | false | Show provider, model, env path info |

---

## Severity levels

| | Level | Behaviour |
|--|-------|-----------|
| 🔴 | **BLOCK** | Security vulnerability or crash/ANR risk — commit is rejected |
| 🟡 | **WARN** | Performance or logic bug — commit allowed, fix before merging |
| 🟠 | **CONVENTION** | Team has a standard for this — use it |
| 🟣 | **WRONG_PKG** | Wrong package for this framework — will crash or not work |
| 🔍 | **UNDECLARED** | Variable, prop, or import missing or never declared |
| 🔵 | **SUGGEST** | Better way to write it — educational, non-blocking |
| ⚪ | **STYLE** | Naming, dead code, readability — non-blocking |

---

## Project structure

```
ai-senior-dev-reviewer/
├── src/
│   ├── index.js              — main orchestrator
│   ├── config.js             — configuration + env loading
│   ├── analyzer/
│   │   ├── git.js            — staged files, diff, codebase snapshot
│   │   ├── prompt.js         — 11-pass review prompt
│   │   └── api.js            — multi-provider AI client (OpenAI/Anthropic/Gemini)
│   ├── memory/
│   │   └── index.js          — patterns.json, blind spots, audit log
│   └── output/
│       └── colors.js         — terminal colour output
├── bin/
│   ├── cli.js                — global CLI entry point
│   ├── install.js            — scoped git hook installer
│   ├── uninstall.js          — hook removal with backup restore
│   └── dashboard.js          — HTML review history generator
└── .ai-reviewer/             — auto-created per project
    ├── patterns.json         — learned team patterns ← commit this
    ├── codebase-context.json — component inventory  ← commit this
    ├── review-log.jsonl      — audit log            ← gitignore this
    └── dashboard.html        — generated report     ← gitignore this
```

---

## .gitignore recommendation

```gitignore
# Never commit
.env
.ai-reviewer/review-log.jsonl
.ai-reviewer/dashboard.html

# DO commit — shared team memory
# .ai-reviewer/patterns.json
# .ai-reviewer/codebase-context.json
```

---

## Contributing

PRs welcome. Main areas to improve:

- More framework-specific checks (Vue, Svelte, Expo Router)
- VS Code extension to show issues inline
- GitHub Actions integration for CI
- Support for more AI providers (Mistral, Ollama for local models)
- Configurable severity rules per project

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## License

MIT — use it, fork it, improve it.

---

<div align="center">

Built by a developer who got tired of catching the same bugs in code review.

**Star it if it saves you from a production crash. ⭐**

</div>