# Changelog

All notable changes to SORK (Security Orchestration, Remediation & Keeping) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
