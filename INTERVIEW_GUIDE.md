# SORK CLI - Interview Preparation Guide

## 1. What is SORK? (30-second elevator pitch)

**SORK** = **S**ecurity **O**rchestration, **R**emediation & **K**eeping

It's an **AI-powered security CLI** for Node.js/TypeScript projects that:

- **Scans** code for 6 common vulnerability types using AST analysis
- **Triages** findings with AI to eliminate false positives
- **Remediates** (auto-fixes) confirmed issues with safe code rewrites
- **Verifies** fixes by re-scanning to catch regressions

**Key Innovation**: Three specialized AI agents working in sequence, plus deterministic fallbacks when no API key is configured.

---

## 2. Architecture: The 3-Agent Pipeline

```
Code Input
    ↓
┌─────────────────────────────────────────────────────────┐
│ SCANNER (AST Walker)                                    │
│ - Uses @typescript-eslint/typescript-estree             │
│ - Walks TypeScript/JavaScript AST                       │
│ - Extracts char-level offsets for precision fixes       │
│ - Detects 6 vulnerability types                         │
└─────────────────────────────────────────────────────────┘
    ↓ [Raw Findings]
┌─────────────────────────────────────────────────────────┐
│ AGENT 01: TRIAGE (False Positive Filter)                │
│ - Analyzes each finding in file context                 │
│ - Asks: "Is this a real vulnerability?"                 │
│ - Dismisses patterns in test files, mocks, etc.         │
│ - Returns: Confirmed + Dismissed findings               │
│ - Fallback: Filename heuristics if no AI                │
└─────────────────────────────────────────────────────────┘
    ↓ [Confirmed Findings]
┌─────────────────────────────────────────────────────────┐
│ AGENT 02: REMEDIATION (Auto-Fixer)                      │
│ - Extracts vulnerable region + surrounding context      │
│ - Asks AI: "What's a safe replacement?"                 │
│ - AI returns new_code + explanation                     │
│ - Preserves identifiers & coding style                  │
│ - Fallback: Deterministic fixes for common types        │
│ - Result: CodeFix objects with oldCode → newCode        │
└─────────────────────────────────────────────────────────┘
    ↓ [Generated Fixes]
┌─────────────────────────────────────────────────────────┐
│ CODE FIXER (Applies Changes)                            │
│ - Applies fixes to source files                         │
│ - Orders by file offset (highest first) to preserve     │
│   positions while applying multiple fixes               │
│ - Runs prettier + eslint --fix on modified files        │
└─────────────────────────────────────────────────────────┘
    ↓ [Modified Files]
┌─────────────────────────────────────────────────────────┐
│ AGENT 03: KEEPER (Verification + Audit)                 │
│ - Re-scans all modified files                           │
│ - Confirms each vulnerability is gone                   │
│ - Detects regressions (new findings)                    │
│ - Maintains append-only audit.log                       │
│ - Returns: Verified, Failed, Regressions               │
└─────────────────────────────────────────────────────────┘
    ↓ [Final Report]
Output: Scan Summary + Audit Trail
```

---

## 3. Each Agent Explained

### Agent 01: TRIAGE (What it does)

**Purpose**: Reduce false positives before AI spending tokens on them

**Input**: Raw vulnerabilities from scanner

```javascript
{
  type: 'HARDCODED_SECRET',
  file: 'tests/fixtures/vulnerable.ts',
  line: 33,
  message: 'Hardcoded secret in apiSecret',
  code: 'const apiSecret = "abc123def"'
}
```

**Process**:

1. Check heuristics first (fast):
   - If filename contains `.test.` or `.spec.` → likely false positive
   - If file path contains `vulnerable`, `bad`, `insecure` → likely intentional
2. If heuristic isn't clear, ask AI:
   - System prompt: Act as security engineer, decide real vs false positive
   - User prompt: Here's the vulnerability + file context (±5 lines)
   - Schema: `{ is_real: boolean, reason: string, severity?: string }`

**Output**: Split findings into `confirmed` and `dismissed`

**Interview Point**: "We save AI tokens by filtering 30-40% of findings via heuristics first."

---

### Agent 02: REMEDIATION (What it does)

**Purpose**: Generate safe code rewrites

**Input**: Confirmed vulnerabilities

```javascript
{
  type: 'SQL_INJECTION',
  file: 'src/db.ts',
  line: 9,
  message: 'SQL string concatenated with variable'
}
```

**Process**:

1. Extract vulnerable region (±10 lines of context)
2. Ask AI: "Here's the vulnerable code. Give me a safe replacement."
   - System prompt: Instructions on preserving identifiers, imports, style
   - User prompt: Full file context + vulnerable region highlighted
   - Schema: `{ new_code: string, description: string }`
3. If AI timeout or fails → fallback to deterministic rules:
   - `INSECURE_RANDOM`: Replace `Math.random()` with `crypto.randomBytes()`
   - `XSS`: Replace `.innerHTML =` with `.textContent =`
   - `HARDCODED_SECRET`: Move to `process.env.XXX`
   - Others: Insert `// SORK TODO:` comment for manual review

**Output**: Array of CodeFix objects

```javascript
{
  type: 'SQL_INJECTION',
  file: 'src/db.ts',
  line: 9,
  oldCode: 'const query = "SELECT * FROM users WHERE id = " + id;',
  newCode: 'const query = "SELECT * FROM users WHERE id = ?"; stmt.bind(id);',
  description: 'Use parameterized queries to prevent SQL injection'
}
```

**Interview Point**: "Remediation is smart about AI fallback—it doesn't fail, it degrades gracefully to deterministic fixes."

---

### Agent 03: KEEPER (What it does)

**Purpose**: Verify fixes work and catch regressions

**Input**: Applied fixes + original vulnerabilities

**Process**:

1. Re-scan all modified files
2. For each fix, check:
   - Is the original vulnerability gone?
   - Are there new findings (regressions)?
3. Write audit log entry:
   ```
   [2026-05-11T22:53:40Z] FIXED SQL_INJECTION src/db.ts:9 → Use parameterized queries
   [2026-05-11T22:53:40Z] REGRESSION UNSAFE_EVAL src/db.ts:23 (introduced by fix)
   ```

**Output**: Verification report

```javascript
{
  verified: [fix1, fix2, ...],      // Fixes that worked
  failed: [fix3, ...],               // Fixes that didn't work
  regressions: [vuln1, vuln2, ...]   // New findings introduced
}
```

**Interview Point**: "Keeper is the safety net—it ensures fixes don't break other parts of the code."

---

## 4. Vulnerability Types Detected

| Type               | What It Catches                                  | Example                                    |
| ------------------ | ------------------------------------------------ | ------------------------------------------ |
| `UNSAFE_EVAL`      | `eval()`, `new Function()`, `setTimeout("code")` | `eval(userInput)`                          |
| `INSECURE_RANDOM`  | `Math.random()` for security                     | `const token = Math.random().toString()`   |
| `XSS`              | `.innerHTML`, `.outerHTML` assignment            | `el.innerHTML = userInput`                 |
| `HARDCODED_SECRET` | Secrets in variable names                        | `const apiKey = "sk-12345"`                |
| `SQL_INJECTION`    | Template literals + concat with variables        | `` `SELECT * FROM users WHERE id=${id}` `` |
| `DEPENDENCY_VULN`  | Wildcard versions in package.json                | `"lodash": "*"`                            |

**Interview Point**: "We use AST analysis, not regex. This means we don't flag secrets inside comments or test data—only real code."

---

## 5. How AI Integration Works

### Two Deployment Modes

**Mode 1: BYOK (Bring Your Own Key)**

```bash
sork config set-key nvapi-xxxxx    # NVIDIA NIM
sork config set model minimaxai/minimax-m2.7
```

- User provides API key
- SORK calls AI provider directly from their machine
- No server in between
- Fast, cheap, user controls costs
- Works offline if needed (fallback mode)

**Mode 2: Sorkcloud (Managed)**

```bash
sork config set-key sork_live_xxxxx
```

- User signs up at sorkcloud.space
- Gets managed key that routes to SORK Cloud
- 14 free requests, then subscription
- SORK Cloud handles model selection + rate limiting
- Audit trail on cloud side

### What Happens With No AI Key

If no API key is set, SORK automatically falls back to:

- **Triage**: Filename heuristics only (test files auto-dismissed)
- **Remediation**: Deterministic rules for common vulnerabilities
- **Keeper**: Re-scan still works (no AI needed)

**Interview Point**: "SORK works even without an AI key. It degrades gracefully—you get the basics, upgrade for AI-powered false positive filtering."

---

## 6. Recent Fixes We Made (v1.2.1)

### Problem 1: Fix Command Hung

**Symptom**: `sork fix` never completed
**Root Cause**: AI requests had no timeout. Invalid API keys caused infinite hangs.
**Fix**: Added 30-45 second timeouts with `Promise.race()` pattern

```typescript
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('AI request timed out')), 45000)
);

await Promise.race([
  aiClient.chat(...),  // AI call
  timeoutPromise        // Timeout
]);
```

### Problem 2: Hardcoded Secret Leak

**Symptom**: Base64-encoded Cohere API key in source
**Fix**: Removed hardcoded key, now only accepts env vars

```bash
COHERE_API_KEY=xxxx sork scan    # Now required
```

### Problem 3: Remediation Didn't Fall Back Gracefully

**Symptom**: If AI failed, remediation crashed instead of using fallback
**Fix**: Added try-catch with explicit fallback logic

```typescript
try {
  return await this.aiFix(vuln); // Try AI
} catch (err) {
  return this.fallbackFix(vuln); // Fall back
}
```

**Interview Point**: "These fixes show how we handle real-world failures: timeouts, invalid credentials, AI downtime. The system is resilient."

---

## 7. Key Technical Decisions

### Why AST Analysis?

- **Regex too loose**: Would flag secrets in comments/strings
- **AST is precise**: Only flags real code nodes
- **Offsets matter**: Character-level precision allows surgical fixes

### Why Multiple AI Calls?

- **Triage**: Filter noise first (saves token budget)
- **Remediation**: Each fix is a separate call (parallelizable)
- **Keeper**: No AI (just re-scan)

### Why Fallbacks?

- **Resilience**: Works when API is down
- **Cost control**: Users choose their AI spending
- **Privacy**: Deterministic fallback doesn't leak code to cloud

---

## 8. Interview Talking Points

### "Tell us about SORK"

"SORK is a three-stage security pipeline for Node.js. It scans code using AST analysis, filters false positives with AI, auto-fixes vulnerabilities, and verifies the fixes didn't break anything. The key innovation is the staged agent architecture—each agent is specialized and can operate independently or together."

### "What's the hardest part?"

"Balancing AI cost with accuracy. If you ask AI to triage _and_ fix, you double your token spend. So we built heuristics to filter findings first, then only spend AI tokens on uncertain cases. We also added timeouts and fallbacks so the tool never hangs waiting for AI."

### "How do you handle false positives?"

"Three layers: filename heuristics (test files auto-dismissed), context-aware AI triage (asks if it's real given surrounding code), and deterministic confirmation (Keeper re-scans to verify). For new users without an AI key, we still work—just with heuristics alone."

### "What about security?"

"API keys never leave the user's machine in BYOK mode. Config is stored with mode 0600 (read-only). Secrets are never logged. For SORK Cloud mode, keys are managed server-side with standard auth. All vulnerability data is isolated per user."

### "Walk us through a fix"

1. Scanner finds `const apiKey = "sk-123"` at line 10
2. Triage asks: "This looks real, not a test mock. Keep it."
3. Remediation asks: "Rewrite this to use env var instead."
4. AI returns: `const apiKey = process.env.API_KEY ?? (() => { throw new Error('API_KEY required'); })()`
5. Keeper re-scans: "Secret is gone, no regressions."
6. Audit log records the fix.

### "Why Zod for schemas?"

"Type safety for AI responses. We tell the AI schema upfront, then validate with Zod before using the response. If AI returns invalid JSON, we retry with a stricter prompt. This prevents crashes from malformed AI output."

---

## 9. Architecture Files (Quick Reference)

| File                        | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `lib/orchestrator.ts`       | Main pipeline coordinator—calls scan → triage → remediate → verify |
| `lib/agents/triage.ts`      | Agent 01—decides real vs false positive                            |
| `lib/agents/remediation.ts` | Agent 02—generates fixes                                           |
| `lib/agents/keeper.ts`      | Agent 03—verifies + audit log                                      |
| `lib/security/scanner.ts`   | AST walker—finds vulnerabilities                                   |
| `lib/fixers/codeFixer.ts`   | Applies fixes to files + prettier/eslint                           |
| `lib/ai/client.ts`          | OpenAI-compatible client (BYOK)                                    |
| `lib/ai/cloudClient.ts`     | Sorkcloud integration                                              |
| `lib/config/index.ts`       | Config loading (file + env vars)                                   |
| `lib/types/index.ts`        | TypeScript types for all data                                      |

---

## 10. Commands to Know

```bash
sork init                           # Set up SORK in project
sork config set-key <KEY>           # Configure API key
sork scan                           # Scan + triage
sork fix                            # Scan + triage + remediate + verify
sork pre-commit                     # Run as git pre-commit hook
sork setup-hooks                    # Install hook
sork status                         # Check config + agent status
```

---

## 11. Example Output (What to Expect)

```
SORK Security Scan
──────────────────────────────────────────────────────

22:48:10 ℹ ORCHESTRATOR Detected 11 potential issue(s)
22:48:10 ℹ ORCHESTRATOR Agent 01 · S (TRIAGE) - Analyzing 11 findings...
22:48:10 ⚠ ORCHESTRATOR 0 dismissed, 11 confirmed

Confirmed Vulnerabilities
──────────────────────────────────────────────────────
1. [CRITICAL] HARDCODED_SECRET
   tests/fixtures/vulnerable.ts:3
   Hardcoded secret in 'apiKey' - move to env var
2. [CRITICAL] SQL_INJECTION
   tests/fixtures/vulnerable.ts:9
   SQL string concatenated with variable - use parameterized queries
... (more findings)

SORK Remediation
──────────────────────────────────────────────────────
22:53:40 ✓ ORCHESTRATOR Generated 11 fix(es)
22:53:40 ✓ ORCHESTRATOR Applied 11/11 fix(es)

SORK Verification
──────────────────────────────────────────────────────
Keeper Summary
──────────────────────────────────────────────────────
Verified: 8
Failed:   3
Regressions: 5
```

---

## 12. Questions You Might Get

**Q: "Why not just use ESLint plugins?"**
A: ESLint is great for style, but not designed for security semantics. SORK does semantic analysis—it understands context (is this a test file?), asks AI to reason about findings, and verifies fixes.

**Q: "How do you prevent the AI from breaking the code?"**
A: Keeper re-scans after fixes. If the original vulnerability isn't gone or new ones appear, the fix is marked failed and reported. We don't claim 100% success—we're transparent about what worked and what didn't.

**Q: "Does this replace manual code review?"**
A: No. SORK catches common patterns fast. For complex logic bugs or architectural issues, you still need humans. Think of it as an automated first pass.

**Q: "How do you handle TypeScript vs JavaScript?"**
A: Same AST walker works for both—TypeScript ESLint parser handles both syntax variants.

**Q: "What's the license?"**
A: MIT. Open source. Anyone can fork and self-host.

---

Good luck with your interview! You've built something solid here. 🚀
