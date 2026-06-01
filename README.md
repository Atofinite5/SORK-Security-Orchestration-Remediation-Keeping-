# @atofinite5/sork-cli

**The official CLI for [Sorkcloud](https://sorkcloud.space)** — an AI-powered security pipeline (Security Orchestration, Remediation & Keeping) for modern codebases.

Scans your code for vulnerabilities across 9 languages, triages false positives, generates fixes, verifies the result, generates regression tests, and learns from your edits.

## Two ways to use

- **Sorkcloud** — paste a managed `sork_live_*` key from [sorkcloud.space](https://sorkcloud.space). 14 free requests, then $19/mo Pro or $28/mo Pro Plus.
- **BYOK** — bring your own API key. Your key, your credits, all calls go directly from your machine to the provider.

> Current status: **v1.4.0**. Multi-language scanner, AI-driven agents (BYOK or Sorkcloud), interactive chat REPL, guard mode, doctor diagnostics, cross-scan memory, fix learning, auto test generation, GitHub Action CI, deterministic fallbacks.

---

## Install

```bash
npm install -g @atofinite5/sork-cli
sork --version  # SORK v1.4.0
```

Requires **Node.js >= 18**.

---

## Quick start (Sorkcloud -- easiest)

```bash
# 1. Sign up at https://sorkcloud.space -> /dashboard -> "Issue new key"
# 2. Copy the sork_live_xxx key

# 3. Scan
sork scan
```

You get 14 AI-powered requests free. Upgrade to Pro for unlimited.

## Quick start (BYOK -- bring your own key)

```bash
sork config set-key <YOUR_API_KEY>
sork config set model <model-name>

sork init
sork scan
sork fix
```

The SORK Engine handles all AI model routing server-side. Just paste a `sork_live_*` key and everything works.

> **Want to use your own AI keys?** Add them via the web dashboard at [sorkcloud.space/dashboard](https://sorkcloud.space/dashboard) -> **API Keys -> BYOK**. Once added, every CLI scan from your machine routes through your own quota automatically -- no CLI config needed.

---

## Languages supported

| Language                | Scanner        | Fix                | Guard |
| ----------------------- | -------------- | ------------------ | ----- |
| TypeScript / JavaScript | AST + patterns | AI + deterministic | Yes   |
| Python                  | Pattern-based  | AI                 | Yes   |
| Rust                    | Pattern-based  | AI                 | Yes   |
| Go                      | Pattern-based  | AI                 | Yes   |
| Java                    | Pattern-based  | AI                 | Yes   |
| C / C++                 | Pattern-based  | AI                 | Yes   |
| Ruby                    | Pattern-based  | AI                 | Yes   |
| PHP                     | Pattern-based  | AI                 | Yes   |
| C#                      | Pattern-based  | AI                 | Yes   |

Language is auto-detected from file extension. Use `sork doctor` to see the full language breakdown of your project.

---

## What it detects

The scanner walks your code AST (TypeScript/JavaScript) or runs pattern-based detection (all other languages):

| Type                | Detects                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `UNSAFE_EVAL`       | `eval(...)`, `new Function(...)`, `setTimeout("...")`, `setInterval("...")`   |
| `INSECURE_RANDOM`   | `Math.random()` used in security contexts                                     |
| `XSS`               | `.innerHTML` / `.outerHTML` assignment, JSX `dangerouslySetInnerHTML`         |
| `HARDCODED_SECRET`  | String literals assigned to `apiKey`, `password`, `token`, `privateKey`, etc. |
| `SQL_INJECTION`     | SQL keywords in template literals with interpolation, or string-concat        |
| `DEPENDENCY_VULN`   | Wildcard or `latest` versions in `package.json`                               |
| `COMMAND_INJECTION` | `exec()`, `spawn()` with unsanitized user input                               |
| `PATH_TRAVERSAL`    | Unchecked path joins with user input                                          |
| `SSRF`              | Fetch/HTTP calls with user-controlled URLs                                    |
| `CRYPTO_WEAK`       | Weak hash algorithms (MD5, SHA1 for security)                                 |

Plus language-specific patterns for Python (`pickle.loads`, `yaml.load`), Rust (`unsafe` blocks), Go (`fmt.Sprintf` in SQL), Java (deserialization), and more.

Findings include character-level offsets so the fixer can replace the exact AST node range.

---

## Interactive Chat (NEW in v1.4.0)

```bash
sork chat
```

Opens an interactive REPL powered by the SORK Engine. Ask anything about security, scan files inline, get fixes with a single command.

### Chat commands

```
/file <path>        Attach a file to analyze
/scan <path>        Quick-scan a file
/fix <path>         Scan + auto-fix a file
/model              Show current model
/model <name>       Switch model
/search <query>     Search security advisories
/save-test <path>   Save last generated test
/history            Show conversation history
/clear              Clear conversation
/help               Show help
/exit               Exit chat
```

Or just type naturally -- SORK auto-detects intent and routes to the right agent.

```
sork > scan this file for XSS vulnerabilities
sork > /file ./src/auth.ts
sork > what's wrong with the password hashing here?
sork > fix it
```

The chat connects to the same multi-agent harness as the web dashboard: safety gate, triage, fix, verify, and memory -- all in your terminal.

---

## Pipeline

```
+------------+    +------------+    +-----------------+    +-----------+    +-----------+
|  Scanner   |--->| Agent 01   |--->| Agent 02        |--->| Agent 03  |--->| Agent 04  |
| (AST walk) |    | TRIAGE     |    | REMEDIATION     |    | KEEPER    |    | TEST GEN  |
|            |    | drop FPs   |    | rewrite code    |    | re-scan   |    | prove fix |
+------------+    +------------+    +-----------------+    +-----------+    +-----------+
                       | AI               | AI                  |               | AI
                       v                  v                     v               v
                  is this real?     safe rewrite?         .sork/audit.log  regression test
```

- **Triage** -- asks the AI whether each finding is real or a false positive given file context. Falls back to filename heuristics when no API key is set.
- **Remediation** -- sends the vulnerable region + surrounding context, generates a safe replacement. Uses learned preferences from your past edits. Falls back to deterministic rewrites for common patterns.
- **Keeper** -- re-runs the scanner to confirm the vuln is gone and no new findings were introduced. Writes to `.sork/audit.log`.
- **Test Gen** -- generates a runnable security regression test that proves the vulnerability is patched. Supports vitest, jest, pytest, go test, JUnit, and Rust test modules.

### Cross-scan memory

SORK tracks recurring vulnerability patterns across your scans. If you keep hitting the same SQL injection pattern in different files, SORK flags it with occurrence counts and suggests project-wide fixes.

### Fix learning

When you edit an AI-generated fix (in the web dashboard diff editor), SORK records the delta and builds a preference model per vulnerability category. Future fixes adapt to your coding style -- if you always prefer `bcrypt` over `argon2`, SORK remembers.

---

## CLI reference

```
sork chat              Interactive AI security chat
sork init              Initialize SORK in current project
sork scan              Run security scan on project
sork scan --file <p>   Scan a single file
sork fix               Auto-fix detected issues
sork status            Show SORK status
sork guard             Watch files in real-time, scan on save
sork review [file]     Review a file or staged diff before committing
sork review --staged   Review only staged changes
sork doctor            Full project health check & language breakdown
sork send [file]       Send a file/folder to SORK Cloud dashboard
sork pre-commit        Run pre-commit hooks (auto-called)
sork setup-hooks       Install git pre-commit hooks
sork hook vscode       Add SORK tasks to .vscode/tasks.json
sork config            Manage AI provider config (BYOK)
```

## AI Agent Initialization

SORK supports initializing dedicated AI agents:

```bash
sork init-claude-agent    # Claude agent
sork init-openai-agent    # OpenAI agent
sork init-codex-agent     # Codex agent
sork init-gemini-agent    # Gemini agent
sork init-mistral-agent   # Mistral agent
sork init-llama-agent     # Llama agent

# List all initialized agents
sork list-agents
```

Agents are stored in `.sork/agents/<model>-agent.json` with provider info, capabilities, and initialization timestamp.

---

## GitHub Action CI (NEW)

Add SORK to your CI pipeline -- scans every PR automatically and posts a comment with findings.

```yaml
# .github/workflows/sork-scan.yml
name: SORK Security Scan
on:
  pull_request:
    branches: [main, dev]

jobs:
  sork-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Atofinite5/sork-back/github-action@main
        with:
          sork-key: ${{ secrets.SORK_API_KEY }}
          fail-on-critical: true
```

The action:

1. Collects the PR diff
2. Sends it to SORK for AI-powered triage
3. Posts a structured PR comment with severity table
4. Optionally fails the check on critical/high findings

---

## Configuration

```bash
# Primary setup
sork config set-key <YOUR_API_KEY>

# Inspect (apiKey is redacted)
sork config list

# Override individual fields
sork config set model       <model-name>
sork config set temperature 0.1
sork config set maxTokens   4096

# Show config file path
sork config path

# Wipe everything
sork config clear
```

Environment variable overrides (useful in CI):

```bash
export SORK_API_KEY=...
export SORK_MODEL=<model-name>
```

---

## Pre-commit hook

```bash
sork setup-hooks
```

Every `git commit` now runs `sork review --staged` and blocks on BLOCK verdict.

### VS Code

```bash
sork hook vscode
```

Adds tasks to `.vscode/tasks.json`. Run via **Cmd+Shift+P -> Tasks: Run Task -> SORK Scan**.

### CI/CD (GitHub Actions)

```yaml
- name: SORK Security Scan
  run: |
    npm i -g @atofinite5/sork-cli
    sork config set-key ${{ secrets.SORK_API_KEY }}
    sork scan
```

### Watch mode

```bash
sork guard
```

Re-scans changed files in 150ms. Inline findings as you save.

---

## Guard mode

```bash
sork guard
```

Watches your project files in real-time. On every save, SORK scans the modified file and shows results in ~150ms. Great for catching issues as you code.

---

## Doctor

```bash
sork doctor
```

Full project health check:

- Language breakdown with file counts and line counts
- Dependency audit
- Configuration validation
- Security posture score 0-100

---

## Pricing

| Plan         | Price  | Limits                                                            |
| ------------ | ------ | ----------------------------------------------------------------- |
| **Free**     | $0     | 14 lifetime scans - 1 license key - all features                  |
| **Pro**      | $19/mo | Unlimited scans - 5 license keys - hybrid memory - priority queue |
| **Pro Plus** | $28/mo | Everything in Pro - 20 license keys - team dashboard - SLA        |

[Subscribe at sorkcloud.space/pricing](https://sorkcloud.space/pricing)

**BYOK direct mode is always free** -- you pay only your AI provider for API calls.

---

## Web Dashboard

Every CLI scan appears live at **[sorkcloud.space/dashboard](https://sorkcloud.space/dashboard)**:

| View              | What you see                                                                  |
| ----------------- | ----------------------------------------------------------------------------- |
| **Command**       | Chat with sork.ai, drop project folders for in-browser scans                  |
| **Scans**         | 7-day activity chart, severity donut, fix rate gauge, top files, scan history |
| **Repositories**  | Connect GitHub, scan any repo                                                 |
| **Pull Requests** | Monaco diff editor + AI merge conflict resolution                             |
| **API Keys**      | License keys + BYOK credentials (AES-256-GCM encrypted)                       |

---

## Security Model

- License keys are **JWTs signed with HMAC-SHA256**
- BYOK credentials are **encrypted at rest (AES-256-GCM)** before hitting the database
- Every request first passes **SORK Engine safety guardrails** (no jailbreaks, no harmful payloads)
- Code submitted for scanning is **never persisted** beyond the pipeline run -- only metadata (file paths, CWE IDs, scores) is stored
- Local config file uses **mode 0600** (owner-read-only)

---

## Troubleshooting

**`Invalid or revoked license key`** -- Your `sork_live_*` key expired or was revoked. Issue a new one at sorkcloud.space/dashboard.

**`401 Unauthorized`** -- BYOK key is invalid. Run `sork config list` to verify, or rotate the key with your provider.

**Slow scans** -- Free tier uses shared queue. Upgrade to Pro for priority routing.

**`Quota exhausted`** -- Free tier has 14 lifetime scans. Add a BYOK key to use your own quota.

**Debug mode** -- `DEBUG=1 sork scan` shows full error traces.

---

## Links

- **npm**: [@atofinite5/sork-cli](https://www.npmjs.com/package/@atofinite5/sork-cli)
- **Website**: [sorkcloud.space](https://sorkcloud.space)
- **Documentation**: [sorkcloud.space/docs](https://sorkcloud.space/docs)
- **CLI source**: [github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-](https://github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-)
- **Issues**: [GitHub Issues](https://github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-/issues)

---

## License

MIT -- see [LICENSE](./LICENSE).

Built for developers who care about shipping secure code.
