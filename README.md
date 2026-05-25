# @atofinite5/sork-cli

**The official CLI for [SORK Cloud](https://sorkcloud.space)** — your AI DevSecOps Engineer that scans, fixes, verifies, and ships secure code.

```
  ███████╗  ██████╗  ██████╗  ██╗  ██╗
  ██╔════╝ ██╔═══██╗ ██╔══██╗ ██║ ██╔╝
  ███████╗ ██║   ██║ ██████╔╝ █████╔╝
  ╚════██║ ██║   ██║ ██╔══██╗ ██╔═██╗
  ███████║ ╚██████╔╝ ██║  ██║ ██║  ██╗
  ╚══════╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝

  Security Orchestration, Remediation & Keeping
```

[![npm version](https://img.shields.io/npm/v/@atofinite5/sork-cli.svg)](https://www.npmjs.com/package/@atofinite5/sork-cli)
[![License: MIT](https://img.shields.io/npm/l/@atofinite5/sork-cli.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@atofinite5/sork-cli.svg)](https://nodejs.org)

Scan repositories · Detect vulnerabilities · Generate fixes · Verify patches · Ship secure code.
**All from your terminal, all powered by your own AI keys.**

---

## Why SORK

| Without SORK                                      | With SORK                                                     |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Manual code reviews catch ~30% of vulnerabilities | AI catches CWE-89, CWE-22, CWE-79, CWE-476 + 40 more patterns |
| Days between bug → fix → verify                   | Seconds — scan, fix, verify in one pipeline                   |
| Locked into one AI vendor                         | BYOK — bring Groq, NVIDIA, Cohere, OpenAI, any key            |
| Generic fixes that break logic                    | Memory-aware fixes consistent with your codebase              |

---

## Install

```bash
npm install -g @atofinite5/sork-cli
sork --version  # SORK v1.3.0
```

Requires **Node.js ≥ 18**.

---

## Quick Start

**One license key. That's all you need.**

```bash
# 1. Sign up at https://sorkcloud.space → Dashboard → API Keys → Issue
# 2. Copy your sork_live_* license key
sork config set-key sork_live_xxxxxxxxxxxx

# 3. Scan
sork scan

# 4. Apply AI-generated fixes
sork fix
```

The SORK Cloud engine handles all the AI model routing server-side. You never need to bring your own Groq, NVIDIA, OpenAI, or Cohere keys to the CLI — just paste a `sork_live_*` key and everything works.

> **Want to use your own AI keys?** Add them via the web dashboard at [sorkcloud.space/dashboard](https://sorkcloud.space/dashboard) → **API Keys → BYOK**. Once added, every CLI scan from your machine routes through your own quota automatically — no CLI config needed.

---

## System Architecture

### Three-tier model routing

SORK uses a smart router that picks the right AI tier for each task:

```
┌─────────────────────────────────────────────────────────────────────┐
│                            sork-cli                                 │
│                                                                     │
│   sork scan   sork fix   sork verify   sork guard   sork doctor     │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │  Bearer sork_live_*  (license key)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SORK Cloud Engine (sork-back)                      │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              Multi-Tier Provider Router                  │     │
│   │                                                          │     │
│   │   chat   →  Groq          (fast llama-3.3-70b)           │     │
│   │   embed  →  Cohere        (embed-english-v3.0)           │     │
│   │   heavy  →  NVIDIA        (Nemotron / large models)      │     │
│   │   safety →  NVIDIA        (Nemotron guardrails)          │     │
│   │                                                          │     │
│   │   Resolves user's BYOK first → inbuilt fallback          │     │
│   └──────────────────────────────────────────────────────────┘     │
│                              │                                      │
│   ┌──────────────────────────┴───────────────────────────────┐     │
│   │                  4-Stage Pipeline                        │     │
│   │                                                          │     │
│   │   ① Safety Gate    →  Nemotron screens every request    │     │
│   │   ② Triage Agent   →  Groq fast pattern detection       │     │
│   │   ③ Fix Agent      →  Minimal-diff patch generation     │     │
│   │   ④ Verify Agent   →  Re-scan + 0–100 score             │     │
│   └──────────────────────────────────────────────────────────┘     │
│                              │                                      │
│   ┌──────────────────────────┴───────────────────────────────┐     │
│   │              Memory & Persistence                        │     │
│   │                                                          │     │
│   │   Cohere embeddings  →  Hybrid semantic + recency        │     │
│   │   PostgreSQL (Neon)  →  Per-user, per-repo context       │     │
│   │   AES-256-GCM        →  BYOK keys encrypted at rest      │     │
│   └──────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### BYOK direct mode (no SORK Cloud)

```
sork-cli  ─── direct API call ───►  NVIDIA / Groq / OpenAI / Ollama
```

Nothing leaves your machine except the model call. Zero telemetry.

---

## Commands

| Command                      | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `sork init`                  | Initialize SORK in current project            |
| `sork config set-key <key>`  | Save license/BYOK key (chmod 600)             |
| `sork config list`           | Show current config                           |
| `sork scan`                  | Full pipeline scan on project                 |
| `sork scan --file ./auth.ts` | Scan a single file                            |
| `sork scan --lang python`    | Scan only files of one language               |
| `sork fix`                   | Apply AI-generated patches                    |
| `sork verify`                | Re-scan patched code, score 0–100             |
| `sork doctor`                | Project health report + language breakdown    |
| `sork guard`                 | Watch mode — re-scan on every file save       |
| `sork review <file>`         | AI review with APPROVE / WARN / BLOCK verdict |
| `sork review --staged`       | Review git staged diff before commit          |
| `sork send <file>`           | Send file to web dashboard                    |
| `sork hook vscode`           | Add SORK tasks to `.vscode/tasks.json`        |
| `sork setup-hooks`           | Install git pre-commit hook                   |
| `sork init-claude-agent`     | Use Claude as fix agent                       |
| `sork init-openai-agent`     | Use OpenAI                                    |
| `sork init-codex-agent`      | Use Codex                                     |
| `sork init-gemini-agent`     | Use Gemini                                    |
| `sork init-mistral-agent`    | Use Mistral                                   |
| `sork init-llama-agent`      | Use Llama                                     |
| `sork list-agents`           | Show initialized agents                       |

---

## Language Support

SORK scans **9+ languages** with 40+ vulnerability patterns:

| Language       | Patterns | Examples                                              |
| -------------- | -------- | ----------------------------------------------------- |
| **TypeScript** | 12       | SQL injection, XSS, prototype pollution, unsafe `any` |
| **JavaScript** | 10       | `eval`, command injection, hardcoded secrets          |
| **Python**     | 8        | `pickle.loads`, `shell=True`, SSRF                    |
| **Rust**       | 5        | `unsafe` blocks, integer overflow                     |
| **Go**         | 6        | SQL string concat, nil dereference                    |
| **Java**       | 7        | XXE, deserialization, weak crypto                     |
| **Ruby**       | 4        | Mass assignment, command injection                    |
| **PHP**        | 5        | SQL injection, file inclusion                         |
| **C/C++**      | 6        | Buffer overflow, format string                        |

Plus **AI artifact detection** — finds hallucinated APIs, torn code, and inconsistent imports in AI-generated code.

---

## Example Output

### `sork scan`

```bash
$ sork scan --file src/api/auth.ts

  src/api/auth.ts [typescript] — 2 issue(s)

  CRITICAL [CWE-89] SQL Injection — Line 47
  → User input concatenated into SQL query string
  Fix: db.prepare("SELECT * FROM users WHERE id = ?").get(id)

  HIGH [CWE-798] Hardcoded Secret — Line 12
  → API key embedded in source code
  Fix: Move to environment variable: process.env.STRIPE_SECRET_KEY
```

### `sork doctor`

```
  ╭──────────────────────────────────────────╮
  │  SORK  ·  Project Health Report          │
  ╰──────────────────────────────────────────╯

  Language Breakdown
  typescript   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  42 files
  python       ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  21 files

  Health Score
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░  80 / 100

  secrets        0    none found ✓
  torn code      0    none found ✓
  ai artifacts   4    verify generated logic
  high-risk      3    auth.ts, queries.ts, parser.py

  clean    Project is in good health ✓
```

### `sork review --staged`

```
  🟡 WARN: 1 high-severity issue in staged changes

  HIGH Line 47 of src/api/auth.ts:
  → SQL string concatenation detected
  Fix: Use prepared statements with parameterized queries
```

---

## Configuration

Config lives at `~/.config/sork/config.json` (mode 0600):

```json
{
  "ai": {
    "apiKey": "sork_live_xxx",
    "baseURL": "https://integrate.api.nvidia.com/v1",
    "model": "meta/llama-3.3-70b-instruct",
    "temperature": 0.2,
    "maxTokens": 4096
  }
}
```

### Environment variables

| Variable         | Purpose                               |
| ---------------- | ------------------------------------- |
| `SORK_API_KEY`   | Override stored API key               |
| `SORK_CLOUD_URL` | Override SORK Cloud backend URL       |
| `COHERE_API_KEY` | Enable Cohere fallback for embeddings |
| `DEBUG=1`        | Verbose error logging                 |

---

## Integration Examples

### Pre-commit hook

```bash
sork setup-hooks
```

Every `git commit` now runs `sork review --staged` and blocks on BLOCK verdict.

### VS Code

```bash
sork hook vscode
```

Adds tasks to `.vscode/tasks.json`. Run via **Cmd+Shift+P → Tasks: Run Task → SORK Scan**.

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

## sork-ignore annotations

Suppress false positives inline:

```typescript
// sork-ignore: CWE-89 — table name is hardcoded, not user input
const query = `SELECT * FROM ${table} WHERE id = ?`;

// sork-ignore-next-line
const debugKey = 'test-only-not-real';
```

Or use a `.sorkignore` file (same syntax as `.gitignore`).

---

## Pricing

| Plan         | Price  | Limits                                                            |
| ------------ | ------ | ----------------------------------------------------------------- |
| **Free**     | $0     | 14 lifetime scans · 1 license key · all features                  |
| **Pro**      | $19/mo | Unlimited scans · 5 license keys · hybrid memory · priority queue |
| **Pro Plus** | $28/mo | Everything in Pro · 20 license keys · team dashboard · SLA        |

[Subscribe at sorkcloud.space/pricing](https://sorkcloud.space/pricing)

**BYOK direct mode is always free** — you pay only your AI provider for API calls.

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
- Every request first passes **Nemotron safety guardrails** (no jailbreaks, no harmful payloads)
- Code submitted for scanning is **never persisted** beyond the pipeline run — only metadata (file paths, CWE IDs, scores) is stored
- Local config file uses **mode 0600** (owner-read-only)

---

## Troubleshooting

**`Invalid or revoked license key`** — Your `sork_live_*` key expired or was revoked. Issue a new one at sorkcloud.space/dashboard.

**`401 Unauthorized`** — BYOK key is invalid. Run `sork config list` to verify, or rotate the key with your provider.

**Slow scans** — Free tier uses shared queue. Upgrade to Pro for priority routing.

**`Quota exhausted`** — Free tier has 14 lifetime scans. Add a BYOK key to use your own quota.

**Debug mode** — `DEBUG=1 sork scan` shows full error traces.

---

## Links

- **npm**: [@atofinite5/sork-cli](https://www.npmjs.com/package/@atofinite5/sork-cli)
- **Website**: [sorkcloud.space](https://sorkcloud.space)
- **Documentation**: [sorkcloud.space/docs](https://sorkcloud.space/docs)
- **CLI source**: [github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-](https://github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-)
- **Issues**: [GitHub Issues](https://github.com/Atofinite5/SORK-Security-Orchestration-Remediation-Keeping-/issues)

---

## License

MIT © [Bhargav Kalambhe](https://github.com/bhargavkalambhe)

Built for developers who care about shipping secure code.
