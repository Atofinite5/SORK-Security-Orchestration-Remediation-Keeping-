# Sork CLI

**The official CLI for [Sorkcloud](https://sorkcloud.space)** — an AI-assisted security pipeline (Security Orchestration, Remediation & Keeping) for Node.js / TypeScript projects.

Scans your code for common vulnerabilities, triages false positives, generates fixes, applies them, and verifies the result by re-scanning.

Two ways to power it:

- **BYOK** — bring your own NVIDIA / OpenAI / Groq / Ollama key. Your key, your credits, all calls go directly from your machine to the provider.
- **Sorkcloud** — paste a managed `sork_live_*` key from [sorkcloud.space](https://sorkcloud.space). 14 free requests, then $19/mo Pro or $28/mo Pro Plus.

> Current status: **v1.0.0** (renamed from `sork-queb`). AST scanner, AI-driven agents (BYOK or Sorkcloud), deterministic fallbacks when neither is configured.

---

## Install

```bash
npm install -g sork-cli
```

Requires Node.js >= 18.

---

## Quick start (Sorkcloud — easiest)

```bash
# 1. Sign up at https://sorkcloud.space → /dashboard → "Issue new key"
# 2. Copy the sork_live_xxx key

sork config set-key sork_live_xxx
sork init
sork scan
```

You get 14 AI-powered requests free. Upgrade to Pro for unlimited.

## Quick start (BYOK — bring your own provider key)

```bash
# Use any OpenAI-compatible provider — NVIDIA, OpenAI, Groq, Ollama, etc.
sork config set-key nvapi-xxx     # NVIDIA NIM
sork config set model minimaxai/minimax-m2.7

sork init
sork scan
sork fix
sork setup-hooks
```

Your key never leaves your machine. SORK calls the provider directly from your laptop. Saved to `~/.sork/config.json` with mode `0600`.

---

## What it detects

The scanner walks your TypeScript/JavaScript AST (via `@typescript-eslint/typescript-estree`), so it doesn't false-positive on patterns inside string or regex literals.

| Type               | Detects                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `UNSAFE_EVAL`      | `eval(...)`, `new Function(...)`, `setTimeout("...")`, `setInterval("...")`                                                 |
| `INSECURE_RANDOM`  | `Math.random()` used in security contexts                                                                                   |
| `XSS`              | `.innerHTML` / `.outerHTML` assignment, JSX `dangerouslySetInnerHTML`                                                       |
| `HARDCODED_SECRET` | String literals assigned to identifiers like `apiKey`, `password`, `token`, `privateKey`, etc. (skips obvious placeholders) |
| `SQL_INJECTION`    | SQL keywords in template literals with interpolation, or string-concat with variables                                       |
| `DEPENDENCY_VULN`  | Wildcard or `latest` versions in `package.json`                                                                             |

Findings include character-level offsets so the fixer can replace the exact AST node range, not the whole line.

---

## How the agents work

```
+------------+    +------------+    +-----------------+    +-----------+
|  Scanner   |--->| Agent 01   |--->| Agent 02        |--->| Agent 03  |
| (AST walk) |    | TRIAGE     |    | REMEDIATION     |    | KEEPER    |
|            |    | drop FPs   |    | rewrite code    |    | re-scan   |
+------------+    +------------+    +-----------------+    +-----------+
                       | AI               | AI                  |
                       v                  v                     v
                  is this real?     safe rewrite?         .sork/audit.log
```

- **Triage** — for each finding, asks the AI whether it's real given file context, or a false positive (e.g., a pattern in a test file). Falls back to filename heuristics when no API key is set.
- **Remediation** — sends the vulnerable region + surrounding context, asks for a safe replacement that preserves your identifiers. Falls back to deterministic rewrites for `INSECURE_RANDOM`, `XSS`, and `HARDCODED_SECRET`. Other types get a `// SORK TODO:` comment when AI is unavailable.
- **Keeper** — re-runs the scanner on every modified file to confirm the vuln is gone and no new findings were introduced. Writes an append-only audit log to `.sork/audit.log`.

---

## Configuration

Most users only ever need one command:

```bash
sork config set-key <YOUR_API_KEY>
```

For the few who want to tune things:

```bash
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

You can also use environment variables (override the config file — useful in CI):

```bash
export SORK_API_KEY=...
export SORK_MODEL=<model-name>
```

Optional Cohere fallback:

```bash
# Used only when no primary SORK key is configured, or when the primary AI call fails.
export COHERE_API_KEY=...
export COHERE_MODEL=command-a-03-2025
```

---

## CLI

```
sork init               Initialize SORK in current project
sork init-claude-agent   Initialize Claude agent
sork init-openai-agent   Initialize OpenAI agent
sork init-codex-agent   Initialize Codex agent
sork init-gemini-agent  Initialize Gemini agent
sork init-mistral-agent Initialize Mistral agent
sork init-llama-agent  Initialize Llama agent
sork list-agents       List all initialized agents
sork config            Manage API key + settings
sork scan              Run security scan
sork fix               Generate + apply fixes, then re-verify
sork status            Show config + agent state
sork pre-commit        Run scan on staged files (used by hook)
sork setup-hooks       Install .git/hooks/pre-commit
```

## AI Agent Initialization

SORK now supports initializing dedicated AI agents for different providers. Each agent is configured for a specific AI model with unique capabilities.

```bash
# Initialize agents for different AI providers
sork init-claude-agent   # Claude Sonnet 4 (Anthropic)
sork init-openai-agent  # GPT-4o (OpenAI)
sork init-codex-agent  # Codex-3 (OpenAI)
sork init-gemini-agent # Gemini 2.0 Pro (Google)
sork init-mistral-agent# Mistral Large (Mistral)
sork init-llama-agent  # Llama 4 Maverick (Meta)

# List all initialized agents
sork list-agents
```

Agents are stored in `.sork/agents/<model>-agent.json` with:

- Provider and model information
- Base API URL
- Capabilities (reasoning, code-analysis, security-audit, etc.)
- Initialization timestamp

---

## Pre-commit hook

```bash
sork setup-hooks
```

Installs `.git/hooks/pre-commit`. On commit, scans only staged files. Blocks the commit if any `CRITICAL` finding is detected.

---

## What's not in scope (yet)

- Languages other than TypeScript/JavaScript
- Full SAST coverage (currently ~6 vuln categories — see table above)
- Network-aware fix generation (e.g., updating a vulnerable dep version)
- A managed cloud version

**Coming in future releases:** support for Claude, OpenAI, Groq, and other providers — pick your favorite at config time.

If you need any of these now, please open an issue.

---

## Contributing

PRs welcome. Please:

1. Open an issue first for non-trivial changes
2. Add a fixture in `tests/fixtures/` if you're adding a new detector
3. Run `npm run qa` before pushing

---

## License

MIT — see [LICENSE](./LICENSE).

Created by [Bhargav Kalambhe](https://github.com/Atofinite5).
