# SORK — Security Orchestration, Remediation & Keeping

## 🔐 Security Conventions

All SORK agents must follow these security-first principles:

### Code Changes
- ✅ All security fixes must include **inline comments referencing CWE IDs**
  - Example: `# SORK: Fixed CWE-79 (XSS) by sanitizing user input`
- ✅ Never suppress security warnings without documented justification
- ✅ Prefer **patched dependency versions** over workarounds
- ✅ Fixes must be **minimal** — no refactoring of unrelated code
- ✅ All **hardcoded secrets** must be replaced with environment variables
- ✅ Input validation uses **allowlists, never blocklists**

### Vulnerability Handling
- ✅ Triage agent must assess **CVSS score** and **exploitability**
- ✅ False positive dismissals must be documented with reasoning
- ✅ Real positives must be prioritized by severity (Critical > High > Medium > Low)
- ✅ Remediation agent must link all fixed vulnerabilities to the MR
- ✅ Keeper agent must verify fix effectiveness before marking complete

### Merge Request Standards
- ✅ Title format: `SORK: Fix [severity] [vulnerability-type] in [file]`
- ✅ Body must include:
  - Vulnerability IDs (CVE, CWE)
  - What changed and why
  - Link to triage issue
  - Testing recommendations
- ✅ All related vulnerabilities linked before merge
- ✅ Security scan must pass before approval

### Commit Standards
- ✅ Format: `security(fix): SORK fix for [CWE-XXX] in [file] (#issue-id)`
- ✅ Message must reference the vulnerability identifier
- ✅ Signed commits required for accountability
- ✅ Never amend published commits

### Audit Trail
- ✅ Triage agent signs off: `✓ SORK Triage 🔒`
- ✅ Remediation agent signs off: `✓ SORK Remediation 🔧`
- ✅ Keeper agent signs off: `✓ SORK Keeper ✔️`
- ✅ All actions logged in issue notes and MR notes

## 🎯 Three-Agent Workflow

```
[Pipeline Complete]
       ↓
   TRIAGE AGENT
   (Analyze & Prioritize)
       ↓
   [Triage Issue Created]
       ↓
   REMEDIATION AGENT
   (Generate & Commit Fix)
       ↓
   [MR Created with Fix]
       ↓
   KEEPER AGENT
   (Verify Resolution)
       ↓
   [Fix Verified & Safe to Merge] ✓
```

## 🚫 Security Red Lines

**STOP immediately and do not proceed if:**
- 🔴 Security scan reveals a **CRITICAL vulnerability**
- 🔴 Hardcoded secrets found (API keys, passwords, tokens)
- 🔴 SQL injection, RCE, or authentication bypass patterns detected
- 🔴 Supply chain risk (compromised package, malicious dependency)
- 🔴 No linked issue or context for changes

## 📋 Triage Checklist (before creating issue)

- [ ] All vulnerabilities listed with IDs
- [ ] Severity assessed (CVSS score included)
- [ ] Exploitability evaluated (reachable in production?)
- [ ] False positives documented with reasoning
- [ ] Real threats prioritized by risk
- [ ] Remediation order recommended

## 🔧 Remediation Checklist (before creating MR)

- [ ] Vulnerable code read and understood
- [ ] Fix is **minimal** (no scope creep)
- [ ] Code style matches project conventions
- [ ] Inline comments reference CWE IDs
- [ ] All related vulns linked in MR body
- [ ] No new secrets introduced
- [ ] Tests pass locally
- [ ] MR description is complete

## ✔️ Keeper Checklist (before marking fixed)

- [ ] Pipeline passed completely
- [ ] Original vulnerability no longer detected
- [ ] No new vulnerabilities introduced
- [ ] Security scan improved or maintained
- [ ] Fix confirmed in production or staging
- [ ] Verification report posted to MR
- [ ] Triage issue closed with summary

---

## GitLab Duo Agent Platform Integration

SORK v2.0 uses GitLab Duo Custom Flows for live agent execution. The flow
definitions live in `.gitlab/duo/flows/`:

| Flow | Trigger | Purpose |
|------|---------|---------|
| `sork-triage.yaml` | `@sork-triage` on issues | Analyze and triage vulnerabilities |
| `sork-remediation.yaml` | `@sork-remediation` on issues | Generate fixes and create MRs |
| `sork-keeper.yaml` | `@sork-keeper` on MRs | Verify fixes before merge |

The `agents/` directory contains the full reference prompts. The `.gitlab/duo/flows/`
files contain the condensed, executable versions that GitLab Duo runs.

## Questions or Issues?

Open an issue in the project with label `question` or `bug` and SORK agents will investigate.
