# Changelog

All notable changes to **Sork CLI** (Security Orchestration, Remediation & Keeping — the CLI for [Sorkcloud](https://sorkcloud.space)) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Optional Cohere AI fallback via `COHERE_API_KEY` / `SORK_COHERE_API_KEY`, used when the primary provider is missing or fails.

## [1.0.0] - 2026-05-06 — Renamed to `sork-cli`

### Changed

- **Package renamed** from `sork-queb` to `sork-cli` under the Sorkcloud brand
- Install command: `npm install -g sork-cli` (was `npm install -g sork-queb`)
- Description and README reframed around Sorkcloud as the brand

### Notes

- Functionally identical to `sork-queb@1.3.0` — no behavior changes
- CLI command is unchanged: still `sork init`, `sork scan`, `sork fix`, etc.
- The legacy `sork-queb` package on npm should be deprecated post-publish
- Version entries below this line refer to the previous package name (`sork-queb`)

---

## [1.3.0] - 2026-05-05

### Added

- **SORK Cloud support** — paste a `sork_live_*` key from sorkcloud.space to use the managed AI proxy (no NVIDIA / OpenAI key needed locally)
- `lib/ai/cloudClient.ts` — HTTP client that calls `https://sorkcloud.space/api/ai/chat`
- `AIProvider` interface in `lib/ai/client.ts` — agents now accept either direct (BYOK) or cloud clients transparently
- `SORK_CLOUD_URL` env var for self-hosted backends and local development
- `sork config list` shows the active mode: `SORK Cloud (managed)` vs `BYOK direct`

### Changed

- Key routing in `AIClient.create()` now detects `sork_live_*` prefix and returns a `CloudClient` instead of an OpenAI direct client
- Agents (`TriageAgent`, `RemediationAgent`) refactored to use `AIProvider` interface
- Status output in `sork status` now shows AI mode per agent

### Notes

- BYOK mode (direct provider keys like `nvapi-`, `sk-`) continues to work unchanged
- Cloud mode hides the model name and provider — these are server-side concerns
- Free trial: 14 lifetime AI requests via SORK Cloud, then upgrade required

## [1.2.0] - 2026-05-04

### Added

- AST-based scanner via `@typescript-eslint/typescript-estree` (replaces fragile regex scanner)
- BYOK config: `sork config set-key` saves to `~/.sork/config.json` (mode 0600)
- Range-based code fixer with start/end character offsets
- `Keeper` now actually re-scans files post-fix (previously a tautology)
- `tests/fixtures/vulnerable.ts` for detector validation

### Changed

- AI agents (Triage, Remediation) wired to OpenAI-compatible providers
- Removed unused `axios`, `dotenv`, `@anthropic-ai/sdk` dependencies
- New `lib/security/astWalker.ts` walks AST instead of grepping lines

### Fixed

- 4 false positives that the regex scanner produced on SORK's own source code

## [2.0.0] - 2026-02-25

### Changed

- **BREAKING:** Migrated from static agent prompts to GitLab Duo Custom Flows (v1 schema)
- Agents now live in `.gitlab/duo/flows/` as executable flow definitions
- Activation changed from manual UI setup to `@mention` triggers
- Removed `test-vulns/` from `SAST_EXCLUDED_PATHS` so security scans actually find test vulnerabilities
- Removed unused `review` stage from CI/CD pipeline
- Updated YAML lint job to include `.gitlab/duo/flows/` files

### Added

- `.gitlab/duo/flows/sork-triage.yaml` — Triage flow triggered by `@sork-triage`
- `.gitlab/duo/flows/sork-remediation.yaml` — Remediation flow triggered by `@sork-remediation`
- `.gitlab/duo/flows/sork-keeper.yaml` — Keeper flow triggered by `@sork-keeper`
- `.gitlab/duo/agent-config.yml` — Execution environment configuration
- `.gitlab/duo/chat-rules.md` — SORK-specific rules for Duo Chat
- `.gitlab/duo/mr-review-instructions.yaml` — MR review rules in GitLab Duo format
- GitLab Duo integration section in AGENTS.md

### Documentation

- Updated README Quick Start for flow-based activation
- Updated AGENTS.md with Duo flow integration details
- Documented authentication setup (manual steps)

### Kept (as reference)

- `agents/*.md` — Full reference prompts for agent behavior
- `config/*.yml` — Design docs for review rules
- `test-vulns/*` — Test fixtures (now scanned by SAST)

## [1.0.0] - 2026-03-25

### Initial Release

- ✓ SORK Triage Agent (S — Security Analysis)
- ✓ SORK Remediation Agent (O+R — Orchestration & Remediation)
- ✓ SORK Keeper Agent (K — Keeping/Verification)
- ✓ Complete agent configuration
- ✓ MR review instructions
- ✓ Full documentation and examples

---

## Legend

- 🔴 **CRITICAL** — System down, immediate action required
- 🟠 **HIGH** — Major vulnerability, schedule remediation
- 🟡 **MEDIUM** — Feature impaired, plan remediation
- 🟢 **LOW** — Informational, nice to have

## Versioning

SORK follows semantic versioning:

- **MAJOR** — Breaking changes to agent prompts or configuration
- **MINOR** — New agents or features
- **PATCH** — Bug fixes and security updates
