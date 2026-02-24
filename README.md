## What is SORK?

SORK automates your entire vulnerability lifecycle on GitLab Duo Agent Platform. Three AI agents work in sequence — **Triage** analyzes and dismisses false positives, **Remediation** generates code fixes and opens merge requests, **Keeper** verifies the fix passed security scans. Hours of manual work, done in minutes.

> *"SORK turns every GitLab security scan from a to-do list into a done list."*

---

## The Problem

AI tools have made writing code **10x faster**. But that speed created a new bottleneck — the **AI Paradox**:

```
  More code written
       │
       ▼
  More security scan findings
       │
       ▼
  More manual triage needed          ◄── This is where teams get stuck
       │
       ▼
  More patches to write
       │
       ▼
  More fixes to verify
       │
       ▼
  Security backlog grows faster than teams can clear it
```

Every vulnerability finding requires a developer to stop feature work, investigate the finding, decide if it's real, write a fix, open an MR, and wait for verification. **This takes 30-60 minutes per vulnerability.** Multiply by dozens of findings across multiple projects — security becomes the biggest drag on delivery speed.

**SORK eliminates this entire loop.**

---

## How SORK Works

### The Name = The Architecture

Each letter in **SORK** maps directly to a capability:

```
  S ─── Security ──────── SORK Triage Agent      ─── Analyze & classify threats
  O ─── Orchestration ─┐
                        ├─ SORK Remediation Agent ─── Generate fixes & open MRs
  R ─── Remediation ───┘
  K ─── Keeping ───────── SORK Keeper Agent       ─── Verify fixes & maintain security
```

### End-to-End Flow

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                                                                       │
 │                            S O R K                                    │
 │            Security Orchestration, Remediation & Keeping              │
 │                                                                       │
 │   ┌───────────────┐                                                   │
 │   │   TRIGGER      │                                                  │
 │   │                │                                                  │
 │   │  • Pipeline    │                                                  │
 │   │    security    │                                                  │
 │   │    scan done   │                                                  │
 │   │                │                                                  │
 │   │  • @mention    │                                                  │
 │   │    in issue    │                                                  │
 │   │    or MR       │                                                  │
 │   └───────┬───────┘                                                   │
 │           │                                                           │
 │           ▼                                                           │
 │   ┌───────────────────────────────────────────────────────────┐       │
 │   │                                                           │       │
 │   │   🔍 AGENT 01: SORK TRIAGE                    [S]        │       │
 │   │                                                           │       │
 │   │   Responsibilities:                                       │       │
 │   │   • Pull full list of detected vulnerabilities            │       │
 │   │   • Read source code where each vuln was found            │       │
 │   │   • Assess reachability — is the code path used?          │       │
 │   │   • Dismiss false positives with documented reasoning     │       │
 │   │   • Confirm real threats with severity + CWE reference    │       │
 │   │   • Create prioritized triage report issue                │       │
 │   │                                                           │       │
 │   │   Tools: List Vulnerabilities · Get Vulnerability Details │       │
 │   │   Dismiss Vulnerability · Confirm Vulnerability           │       │
 │   │   Read File · Grep · Create Issue · Link Vulnerability    │       │
 │   │                                                           │       │
 │   │   Output: "SORK Security Triage Report" issue             │       │
 │   │                                                           │       │
 │   └──────────────────────┬────────────────────────────────────┘       │
 │                          │                                            │
 │                          ▼                                            │
 │   ┌───────────────────────────────────────────────────────────┐       │
 │   │                                                           │       │
 │   │   🔧 AGENT 02: SORK REMEDIATION               [O+R]     │       │
 │   │                                                           │       │
 │   │   Responsibilities:                                       │       │
 │   │   • Read vulnerable files with full context               │       │
 │   │   • Search for other instances of same pattern            │       │
 │   │   • Generate the smallest possible fix                    │       │
 │   │   • Follow project's existing code style                  │       │
 │   │   • Create branch, commit fix, open merge request         │       │
 │   │   • Link all addressed vulnerabilities to the MR          │       │
 │   │                                                           │       │
 │   │   Tools: Read File · Edit File · Create Commit            │       │
 │   │   Create Merge Request · Link Vulnerability To MR         │       │
 │   │   Grep · Find Files · Run Command · CI Linter             │       │
 │   │                                                           │       │
 │   │   Output: Fix merge request with linked vulns             │       │
 │   │                                                           │       │
 │   └──────────────────────┬────────────────────────────────────┘       │
 │                          │                                            │
 │                          ▼                                            │
 │   ┌───────────────────────────────────────────────────────────┐       │
 │   │                                                           │       │
 │   │   ✅ AGENT 03: SORK KEEPER                     [K]       │       │
 │   │                                                           │       │
 │   │   Responsibilities:                                       │       │
 │   │   • Monitor the fix MR's CI/CD pipeline                   │       │
 │   │   • Wait for security scans to re-run                     │       │
 │   │   • Verify original vulns no longer appear                │       │
 │   │   • Check that no new vulns were introduced               │       │
 │   │   • Post verification report on the MR                    │       │
 │   │   • Update triage issue with final outcome                │       │
 │   │                                                           │       │
 │   │   Tools: Get Merge Request · Get Pipeline Errors          │       │
 │   │   Get Job Logs · List Security Findings                   │       │
 │   │   Create Merge Request Note · List Vulnerabilities        │       │
 │   │                                                           │       │
 │   │   Output: Verification report — SAFE TO MERGE / NOT      │       │
 │   │                                                           │       │
 │   └───────────────────────────────────────────────────────────┘       │
 │                                                                       │
 └─────────────────────────────────────────────────────────────────────┘
```

### Pipeline Flow (Simplified)

```
  SCAN          TRIAGE         REMEDIATE       VERIFY          DONE
   │              │               │              │              │
   ▼              ▼               ▼              ▼              ▼
 ┌─────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌──────┐
 │ 15  │    │ 4 false  │    │ Fix MR  │    │ Pipeline│    │  0   │
 │vulns│───▶│ 3 real   │───▶│ created │───▶│ passed  │───▶│vulns │
 │found│    │ 8 review │    │ 3 fixed │    │ verified│    │ left │
 └─────┘    └──────────┘    └─────────┘    └─────────┘    └──────┘
```

---

## Daily Impact

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                    │
 │  WITHOUT SORK                    │  WITH SORK                     │
 │                                  │                                │
 │  09:00  Push code                │  09:00  Push code              │
 │  09:15  15 vulns found           │  09:15  15 vulns found         │
 │  09:20  Stop feature work        │  09:15  SORK activates         │
 │  09:25  Start investigating...   │  09:20  8 false positives      │
 │  10:00  First vuln resolved      │         dismissed              │
 │  10:30  Second vuln resolved     │  09:22  3 fixes generated      │
 │  11:00  Third vuln, writing fix  │  09:25  MR opened              │
 │  11:30  Open MR, wait pipeline   │  09:35  Pipeline verified ✓    │
 │  12:00  Lunch. 0 features done.  │  09:36  Review MR → merge      │
 │                                  │  09:40  Back to feature work   │
 │  TIME: 3+ hours                  │  TIME: 5 minutes               │
 │  FEATURES: 0                     │  FEATURES: Full day            │
 │                                  │                                │
 └──────────────────────────────────────────────────────────────────┘
```

---

## Agents in Detail

### 🔍 SORK Triage — Agent 01 `[S]`

The first line of defense. Analyzes every vulnerability and separates real threats from noise.

**What it does:**

- Pulls all detected vulnerabilities from the pipeline
- Reads the actual source code at each vulnerability location
- Assesses reachability — is the vulnerable code path used in production?
- Dismisses false positives with documented reasoning
- Confirms real threats with severity ratings and CWE references
- Creates a summary issue: **SORK Security Triage Report**

**14 Tools:**
`List Vulnerabilities` · `Get Vulnerability Details` · `Get Security Finding Details` · `Dismiss Vulnerability` · `Confirm Vulnerability` · `Revert To Detected Vulnerability` · `Update Vulnerability Severity` · `Read File` · `Read Files` · `Create Issue` · `Create Issue Note` · `Link Vulnerability To Issue` · `Grep` · `Find Files`

**Example Output:**
```
╔══════════════════════════════════════════════════════╗
║             SORK SECURITY TRIAGE REPORT              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Scan: Pipeline #4821                                ║
║  Total findings: 12                                  ║
║                                                      ║
║  CONFIRMED ────────────────────────────── 3 found    ║
║                                                      ║
║  [CRITICAL] CVE-2024-1029                            ║
║  SQL Injection in auth.py:42                         ║
║  → User input directly concatenated into query       ║
║  → Code path reachable via /api/login endpoint       ║
║                                                      ║
║  [CRITICAL] CWE-798                                  ║
║  Hardcoded API key in config.py:15                   ║
║  → Production API key committed to source            ║
║  → Key is actively used in payment processing        ║
║                                                      ║
║  [HIGH] CVE-2024-3841                                ║
║  XSS in templates/user.html:8                        ║
║  → User input rendered without sanitization          ║
║  → Accessible to unauthenticated users               ║
║                                                      ║
║  DISMISSED ────────────────────────────── 4 cleared  ║
║                                                      ║
║  [DISMISSED] CVE-2023-1234                           ║
║  lodash prototype pollution                          ║
║  → Reason: lodash imported but pollutable methods    ║
║    are never called with user-controlled input       ║
║                                                      ║
║  [DISMISSED] CVE-2023-5678                           ║
║  axios SSRF vulnerability                            ║
║  → Reason: axios only used for internal API calls    ║
║    with hardcoded URLs, no user input in URL params  ║
║                                                      ║
║  [DISMISSED] CWE-327                                 ║
║  Weak cryptographic algorithm                        ║
║  → Reason: MD5 usage found in test file only         ║
║    (test_helpers.py), not in production code          ║
║                                                      ║
║  [DISMISSED] CWE-22                                  ║
║  Path traversal in file handler                      ║
║  → Reason: Input is validated by sanitize_path()     ║
║    at line 38 before reaching file open at line 52   ║
║                                                      ║
║  NEEDS REVIEW ─────────────────────────── 5 pending  ║
║                                                      ║
║  Recommended remediation order:                      ║
║  1. CVE-2024-1029 (Critical — exploitable SQLi)      ║
║  2. CWE-798 (Critical — exposed production key)      ║
║  3. CVE-2024-3841 (High — public-facing XSS)         ║
║                                                      ║
║                            — SORK Triage 🔍          ║
╚══════════════════════════════════════════════════════╝
```

---

### 🔧 SORK Remediation — Agent 02 `[O+R]`

The fix engine. Generates targeted code patches for every confirmed vulnerability.

**What it does:**

- Reads the vulnerable file with full context (imports, functions, data flow)
- Searches for other instances of the same vulnerability pattern
- Generates the smallest possible fix — no unnecessary refactoring
- Follows the project's existing code style
- Creates a branch, commits the fix, opens a merge request
- Links all addressed vulnerabilities to the MR

**15 Tools:**
`Read File` · `Read Files` · `Get Repository File` · `Find Files` · `Grep` · `Edit File` · `Create File With Contents` · `Create Merge Request` · `Create Merge Request Note` · `Create Commit` · `Link Vulnerability To Merge Request` · `Create Vulnerability Issue` · `Run Command` · `CI Linter` · `Get Issue`

**Example Fix:**
```diff
 # auth.py — SORK Fix for CVE-2024-1029 (SQL Injection)

- def get_user(user_id):
-     query = f"SELECT * FROM users WHERE id = {user_id}"
-     cursor.execute(query)
+ def get_user(user_id):
+     # SORK: Fixed CWE-89 — Use parameterized query to prevent SQL injection
+     query = "SELECT * FROM users WHERE id = ?"
+     cursor.execute(query, (user_id,))
      return cursor.fetchone()
```

```diff
 # config.py — SORK Fix for CWE-798 (Hardcoded Secret)

- API_KEY = "sk-proj-abc123realkey456"
- DB_PASSWORD = "admin123"
+ import os
+ # SORK: Fixed CWE-798 — Move secrets to environment variables
+ API_KEY = os.environ.get("API_KEY")
+ DB_PASSWORD = os.environ.get("DB_PASSWORD")
```

**Example Merge Request:**
```
╔══════════════════════════════════════════════════════╗
║  MERGE REQUEST !247                                  ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Title: SORK: Fix critical vulnerabilities           ║
║         in auth.py and config.py                     ║
║                                                      ║
║  Branch: sork/fix-cve-2024-1029-cwe-798              ║
║                                                      ║
║  Vulnerabilities addressed:                          ║
║  • CVE-2024-1029 (Critical) — SQL injection          ║
║    auth.py:42 → parameterized query                  ║
║  • CWE-798 (Critical) — Hardcoded API key            ║
║    config.py:15 → environment variables              ║
║  • CVE-2024-3841 (High) — XSS                        ║
║    templates/user.html:8 → escaped output            ║
║                                                      ║
║  Changes: 3 files modified, 12 lines changed         ║
║                                                      ║
║  Testing recommendations:                            ║
║  • Verify login flow still works (auth.py change)    ║
║  • Set API_KEY and DB_PASSWORD env vars in CI        ║
║  • Check user profile page renders correctly          ║
║                                                      ║
║  Linked: Triage Report #142                          ║
║                                                      ║
║                       — SORK Remediation 🔧          ║
╚══════════════════════════════════════════════════════╝
```

---

### ✅ SORK Keeper — Agent 03 `[K]`

The verifier. Watches the fix pipeline and confirms vulnerabilities are resolved.

**What it does:**

- Monitors the fix MR's CI/CD pipeline
- Waits for security scans to re-run on the patched code
- Verifies original vulnerabilities no longer appear
- Checks that no new vulnerabilities were introduced
- Posts a verification report directly on the merge request

**13 Tools:**
`Get Merge Request` · `Get Pipeline Errors` · `Get Pipeline Failing Jobs` · `Get Job Logs` · `List Security Findings` · `List Merge Request Diffs` · `List All Merge Request Notes` · `Create Merge Request Note` · `Update Merge Request` · `List Vulnerabilities` · `Get Vulnerability Details` · `Create Issue Note` · `Get Issue`

**Example Verification Report:**
```
╔══════════════════════════════════════════════════════╗
║           SORK VERIFICATION REPORT  ✅               ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Merge Request: !247                                 ║
║  Pipeline: #4835 — PASSED                            ║
║                                                      ║
║  VULNERABILITY STATUS                                ║
║  ─────────────────────────────────────────           ║
║  ✅ CVE-2024-1029  SQL Injection     → RESOLVED      ║
║  ✅ CWE-798        Hardcoded Secret  → RESOLVED      ║
║  ✅ CVE-2024-3841  XSS               → RESOLVED      ║
║                                                      ║
║  REGRESSION CHECK                                    ║
║  ─────────────────────────────────────────           ║
║  New vulnerabilities introduced: 0                   ║
║  Existing tests: ALL PASSING                         ║
║  Security scans: CLEAN                               ║
║                                                      ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            ║
║  RECOMMENDATION: SAFE TO MERGE ✅                    ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            ║
║                                                      ║
║                           — SORK Keeper ✅           ║
╚══════════════════════════════════════════════════════╝
```

---

## Quick Start

### Prerequisites

- GitLab Premium or Ultimate account
- GitLab Duo Agent Platform enabled ([setup guide](https://docs.gitlab.com/user/duo_agent_platform/))
- Security scanning templates in your CI/CD pipeline
- VS Code with [GitLab extension](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow) (v6.15.1+) or JetBrains IDE with GitLab plugin

### Step 1 — Enable Security Scanning

Add this to your `.gitlab-ci.yml`:

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml

stages:
  - build
  - test
  - security
```

### Step 2 — Enable SORK Agents

1. Go to **Explore → AI Catalog → Agents**
2. Search for `SORK Triage` → click **Enable in group** → select your group
3. Repeat for `SORK Remediation` and `SORK Keeper`
4. In your project: **Automate → Agents** → enable all three

### Step 3 — Add Project Configuration

Create `AGENTS.md` in your project root:

```markdown
# SORK — Security Orchestration, Remediation & Keeping

## Security Conventions
- All security fixes must include inline comments referencing CWE IDs
- Never suppress security warnings without documentation
- Prefer patched dependency versions over workarounds
- Fixes should be minimal — don't refactor unrelated code
- Hardcoded secrets must be replaced with environment variables
- Input validation must use allowlists, not blocklists
```

Create `.gitlab/duo/mr-review-instructions.yaml`:

```yaml
instructions:
  - name: SORK Security Standards
    fileFilters:
      - "**/*.py"
      - "**/*.js"
      - "**/*.ts"
      - "**/*.rb"
      - "**/*.go"
      - "**/*.java"
    instructions: |
      1. Security fixes must include inline comments referencing CWE IDs
      2. Never suppress security warnings without documentation
      3. Prefer patched dependency versions over workarounds
      4. All fixes should be minimal — don't refactor unrelated code
      5. Hardcoded secrets must be replaced with environment variables
      6. Input validation must use allowlists, not blocklists
```

### Step 4 — Done

SORK activates automatically on your next pipeline security scan.

### Usage

**Automatic** — Push code → pipeline runs → security scan completes → SORK activates

**Manual via @mention** — In any issue or MR:
```
@sork-triage analyze all vulnerabilities in this project
```

**Manual via Chat** — Open GitLab Duo Chat (Agentic mode):
```
@SORK Triage — run a full vulnerability analysis on this project
```

---

## Tech Stack

### Architecture Diagram

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                       GITLAB INSTANCE                             │
 │                                                                    │
 │   ┌────────────────┐       ┌──────────────────────────────────┐   │
 │   │                │       │   GitLab Duo Agent Platform       │   │
 │   │   CI/CD        │       │                                  │   │
 │   │   Pipeline     │       │   ┌──────────┐  ┌────────────┐  │   │
 │   │                │       │   │ Anthropic │  │ AI Catalog │  │   │
 │   │   ┌─────────┐  │       │   │ Claude    │  │            │  │   │
 │   │   │ SAST    │  │       │   └─────┬────┘  └─────┬──────┘  │   │
 │   │   │ DepScan │──│──────▶│         │             │          │   │
 │   │   │ SecDet  │  │       │         ▼             ▼          │   │
 │   │   └─────────┘  │       │   ┌──────────────────────────┐  │   │
 │   │                │       │   │       SORK FLOW          │  │   │
 │   └────────────────┘       │   │                          │  │   │
 │                            │   │  ┌────────┐              │  │   │
 │                            │   │  │Triage  │              │  │   │
 │                            │   │  │Agent 01│              │  │   │
 │                            │   │  └───┬────┘              │  │   │
 │                            │   │      │                   │  │   │
 │                            │   │      ▼                   │  │   │
 │                            │   │  ┌──────────┐           │  │   │
 │                            │   │  │Remediate │           │  │   │
 │                            │   │  │Agent 02  │           │  │   │
 │                            │   │  └───┬──────┘           │  │   │
 │                            │   │      │                   │  │   │
 │                            │   │      ▼                   │  │   │
 │                            │   │  ┌────────┐             │  │   │
 │                            │   │  │Keeper  │             │  │   │
 │                            │   │  │Agent 03│             │  │   │
 │                            │   │  └────────┘             │  │   │
 │                            │   │                          │  │   │
 │                            │   └──────────────────────────┘  │   │
 │                            │                                  │   │
 │                            └──────────────────────────────────┘   │
 │                                          │                        │
 │                                          ▼                        │
 │   ┌────────────────┐       ┌──────────────────────────────────┐   │
 │   │                │       │                                  │   │
 │   │   Issues        │       │   Merge Requests                │   │
 │   │   (Triage       │       │   (Fix Patches +                │   │
 │   │    Reports)     │       │    Verification Reports)        │   │
 │   │                │       │                                  │   │
 │   └────────────────┘       └──────────────────────────────────┘   │
 │                                                                    │
 └──────────────────────────────────────────────────────────────────┘
```

### Stack Breakdown

| Layer | Technology | Role |
|-------|-----------|------|
| **Platform** | GitLab Duo Agent Platform | Hosts and runs all agents and flows |
| **AI Model** | Anthropic Claude | Powers all 3 agents (default in GitLab Duo) |
| **Agent Registry** | GitLab AI Catalog | Create, publish, and manage SORK agents |
| **Orchestration** | GitLab Flows | Chains agents: Triage → Remediation → Keeper |
| **CI/CD** | GitLab CI/CD + Runner | Runs security scans, triggers SORK, verifies fixes |
| **Security Scanning** | GitLab SAST | Finds code vulnerabilities (SQLi, XSS, etc.) |
| **Security Scanning** | GitLab Dependency Scanning | Finds CVEs in dependencies |
| **Security Scanning** | GitLab Secret Detection | Finds hardcoded secrets and keys |
| **Configuration** | YAML | Agent configs, flow configs, CI pipeline, review rules |
| **Documentation** | Markdown | AGENTS.md, README, system prompts |
| **Test Project** | Python + Flask | Sample vulnerable app for demonstration |
| **Containers** | Docker | Flow execution environment |

### Tools Usage Map

```
 SORK TRIAGE (14 tools)         SORK REMEDIATION (15 tools)      SORK KEEPER (13 tools)
 ──────────────────────         ───────────────────────────       ─────────────────────
 List Vulnerabilities           Read File / Read Files            Get Merge Request
 Get Vulnerability Details      Get Repository File               Get Pipeline Errors
 Get Security Finding Details   Find Files                        Get Pipeline Failing Jobs
 Dismiss Vulnerability          Grep                              Get Job Logs
 Confirm Vulnerability          Edit File                         List Security Findings
 Revert To Detected             Create File With Contents         List Merge Request Diffs
 Update Vuln Severity           Create Merge Request              List All MR Notes
 Read File / Read Files         Create MR Note                    Create MR Note
 Create Issue                   Create Commit                     Update Merge Request
 Create Issue Note              Link Vulnerability To MR          List Vulnerabilities
 Link Vulnerability To Issue    Create Vulnerability Issue        Get Vulnerability Details
 Grep                           Run Command                       Create Issue Note
 Find Files                     CI Linter                         Get Issue
 Get Repository File            Get Issue / List Issue Notes
                                                          
 Total unique tools used: 25+
```

---

## Before & After

```
 ┌───────────────────────────────┬───────────────────────────────┐
 │        WITHOUT SORK           │         WITH SORK             │
 ├───────────────────────────────┼───────────────────────────────┤
 │                               │                               │
 │  Manual triage per vuln:      │  Automated triage per vuln:   │
 │  30-45 minutes                │  1-2 minutes                  │
 │                               │                               │
 │  False positive handling:     │  False positive handling:     │
 │  Manual investigation         │  Auto-dismissed with reason   │
 │                               │                               │
 │  Fix writing:                 │  Fix writing:                 │
 │  30-60 minutes                │  2-5 minutes                  │
 │                               │                               │
 │  Fix verification:            │  Fix verification:            │
 │  15-30 minutes                │  2-3 minutes (automated)      │
 │                               │                               │
 │  Full vuln lifecycle:         │  Full vuln lifecycle:         │
 │  2-4 hours                    │  10-15 minutes                │
 │                               │                               │
 │  Audit trail:                 │  Audit trail:                 │
 │  Partial, manual              │  Complete, automatic          │
 │                               │                               │
 │  Developer time on security:  │  Developer time on security:  │
 │  3-5 hours/week               │  30 min/week (review only)    │
 │                               │                               │
 │  Security backlog:            │  Security backlog:            │
 │  Growing                      │  Cleared automatically        │
 │                               │                               │
 └───────────────────────────────┴───────────────────────────────┘
```

---

## Project Structure

```
sork/
│
├── README.md                                 # This file
├── LICENSE                                   # MIT License
├── AGENTS.md                                 # Project-level agent instructions
├── CHANGELOG.md                              # Version history
├── CONTRIBUTING.md                           # Contribution guidelines
│
├── .gitlab-ci.yml                            # CI/CD pipeline with security scanning
│
├── .gitlab/
│   └── duo/
│       ├── agent-config.yml                  # SORK flow execution configuration
│       └── mr-review-instructions.yaml       # Security-focused code review rules
│
├── agents/
│   ├── sork-triage-prompt.md                 # Triage agent system prompt
│   ├── sork-remediation-prompt.md            # Remediation agent system prompt
│   └── sork-keeper-prompt.md                 # Keeper agent system prompt
│
├── assets/
│   ├── sork-logo.png                         # SORK logo (full)
│   └── sork-avatar.png                       # SORK logo (square avatar)
│
├── test-project/
│   ├── app.py                                # Flask app with intentional vulns
│   ├── config.py                             # Hardcoded secrets (for testing)
│   ├── requirements.txt                      # Outdated dependencies with CVEs
│   └── templates/
│       └── user.html                         # XSS-vulnerable template
│
└── docs/
    ├── architecture.md                       # Detailed architecture documentation
    ├── tech-stack.md                         # Full technology stack details
    └── demo-script.md                        # Demo video recording script
```

---

## Use Cases

### 1. Weekly Security Sweep
Your team runs scans weekly. Without SORK, security engineer spends Monday morning triaging 40+ findings. With SORK, they arrive to 3 ready-to-merge MRs and a clean triage report.

### 2. Compliance Audit
Auditor asks: "Show me how you handle vulnerabilities." With SORK, open any project — every finding has a documented triage decision, a linked fix MR, and a verification report. Complete audit trail.

### 3. Critical CVE Response
A critical CVE drops. Trigger SORK across all projects. It identifies which are actually affected, generates patches, and verifies fixes — hours instead of days.

### 4. Developer Onboarding
Junior dev pushes code with a security flaw. SORK catches it immediately, generates the secure pattern as a fix, and the developer learns the correct approach from SORK's patch.

---

## Demo

<p align="center">
  <a href="YOUR_YOUTUBE_LINK_HERE">
    <img src="https://img.shields.io/badge/▶_Watch_Full_Demo_(3_min)-YouTube-white?style=for-the-badge&labelColor=000000" alt="Watch Demo"/>
  </a>
</p>

**What you'll see:**

| Timestamp | Scene |
|-----------|-------|
| 0:00 | SORK project overview |
| 0:15 | The problem — 12 vulnerabilities in security dashboard |
| 0:35 | SORK Triage — analyzing, dismissing false positives, confirming threats |
| 1:10 | SORK Remediation — generating fixes, opening merge request |
| 1:50 | SORK Keeper — verifying pipeline passed, posting report |
| 2:25 | Results — before/after security dashboard comparison |
| 2:50 | Closing — project built on GitLab Duo + Anthropic Claude |

---

## Future Roadmap

```
 v1.0 (Current — Hackathon)
 ├── Three custom agents: Triage, Remediation, Keeper
 ├── Flow orchestration: Triage → Fix → Verify
 ├── Auto-trigger on pipeline security scan completion
 └── Manual trigger via @mention and Chat

 v1.1 (Planned)
 ├── Multi-project scanning across GitLab groups
 ├── Severity-based routing (critical = immediate, medium = batched)
 └── Custom dismissal rules per project

 v2.0 (Vision)
 ├── Pattern learning from historical dismissals
 ├── Compliance report generation (SOC 2, ISO 27001)
 ├── MCP integration (Jira, Slack, PagerDuty notifications)
 └── Security posture scoring per project
```

---

## Hackathon

**Competition:** [GitLab Duo Agent Platform Challenge](https://gitlab.devpost.com)

**Category:** Most Impactful on GitLab & Anthropic

**Team:**

| Member | Role | Responsibility |
|--------|------|---------------|
| [Your Name] | Architect | Agent design, flow orchestration, system prompts |
| [Teammate A] | Lab Builder | Test infrastructure, vulnerability scenarios, demo video |
| [Teammate B] | Documenter | README, Devpost submission, compliance, documentation |

---

## Built With

`GitLab Duo Agent Platform` · `Anthropic Claude` · `GitLab AI Catalog` · `GitLab Flows` · `GitLab CI/CD` · `GitLab SAST` · `GitLab Dependency Scanning` · `GitLab Secret Detection` · `Python` · `Flask` · `Docker` · `YAML`

---

## License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 SORK Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  <strong>S O R K</strong><br>
  Security Orchestration, Remediation & Keeping<br><br>
  <em>Keeping your code secure — automatically.</em><br><br>
  Built with ❤ on GitLab Duo Agent Platform + Anthropic Claude
</p>
