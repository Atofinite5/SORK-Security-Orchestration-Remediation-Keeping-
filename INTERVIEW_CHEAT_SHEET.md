# SORK - Quick Interview Cheat Sheet

## The Elevator Pitch (20 seconds)

"SORK is an AI-powered security CLI for Node.js. It scans code for vulnerabilities, uses AI to triage false positives, generates fixes, and verifies the results. Think of it as an automated security engineer that works on your machine."

---

## The Pipeline (Visual)

```
Raw Code
   ↓
Scan (AST) → 11 findings
   ↓
Triage (AI) → 11 confirmed, 0 false positives
   ↓
Remediate (AI) → 11 fixes generated
   ↓
Apply → 11 files modified
   ↓
Verify (Keeper) → 8 verified, 3 failed, 5 regressions
   ↓
Report
```

---

## 6 Vulnerability Types

| Type             | Example                         | Fix                                |
| ---------------- | ------------------------------- | ---------------------------------- |
| UNSAFE_EVAL      | `eval(code)`                    | Remove or use Function constructor |
| INSECURE_RANDOM  | `Math.random()`                 | Use `crypto.randomBytes()`         |
| XSS              | `.innerHTML = x`                | Use `.textContent = x`             |
| HARDCODED_SECRET | `const apiKey = "xxx"`          | Use `process.env.API_KEY`          |
| SQL_INJECTION    | `` `SELECT * WHERE id=${id}` `` | Use parameterized queries          |
| DEPENDENCY_VULN  | `"lodash": "*"`                 | Pin versions                       |

---

## 3 Agents (Remember: "STK")

- **S (01 TRIAGE)** = Security engineer asking "is this real?" → Dismisses false positives
- **T (02 REMEDIATION)** = Tech lead suggesting "how to fix?" → Generates safe rewrites
- **K (03 KEEPER)** = QA verifying "does it work?" → Re-scans + audit log

---

## Two Ways to Power It

```
BYOK                          |  Sorkcloud
───────────────────────────   |  ───────────────
sork config set-key nvapi-xxx |  sork config set-key sork_live_xxx
Your machine → NVIDIA         |  Your machine → Sorkcloud → Provider
You control cost              |  $0 free, $19/mo Pro
```

---

## What Happens With No AI Key?

```
TRIAGE:       Heuristics only (test files auto-dismissed)
REMEDIATION:  Deterministic rules (Math.random → crypto, etc.)
KEEPER:       Re-scan (always works)

Result: SORK still runs, just less intelligent false-positive filtering
```

---

## Recent Fixes (Why Your Fix Took 5 Minutes)

1. **Added Timeouts**: `Promise.race([aiCall, timeout])` → No more hanging
2. **Removed Hardcoded Secret**: Only env vars now
3. **Better Fallback Logic**: Try AI → catch error → use deterministic fix

---

## Why AST Analysis Matters

```
Regex ("api.*key.*="):
├─ Finds: const apiKey = "secret"  ✓
├─ Finds: // This is an apiKey hint  ✗ (false positive!)
└─ Finds: const s = "apiKey"  ✗ (false positive!)

AST Analysis:
├─ Finds: const apiKey = "secret"  ✓
├─ Skips: // Comments
├─ Skips: String literals
└─ Precise to character offsets
```

---

## Key Numbers to Mention

- **6** vulnerability types detected
- **3** AI agents (triage, remediate, verify)
- **30-45s** timeout per AI request
- **2** deployment modes (BYOK + Cloud)
- **MIT** license (open source)

---

## If Asked About Security

1. **API Keys**: Stored `~/.sork/config.json` with mode 0600
2. **Data Privacy**: BYOK mode = no cloud, all local
3. **Audit Trail**: Keeper maintains append-only `.sork/audit.log`
4. **No Logging**: Secrets never logged or sent anywhere

---

## If Asked "Walk Us Through a Fix"

```
Input:  const apiKey = "sk-123456"  (line 3)

Triage: "This is in a fixture file showing real vulnerability. Keep it."

Remediate:
  Ask AI: "Given this code, write a safe version"
  AI says: "const apiKey = process.env.API_KEY ?? (() => { ... })()"

Apply:
  Replace line 3 with the new code

Verify:
  Re-scan line 3 → "Secret gone. No regressions."
  Write to audit.log: "FIXED HARDCODED_SECRET at line 3"

Output: ✓ 1 verified fix
```

---

## If Asked About Failures

"Keeper reports 3 failed fixes and 5 regressions. This is honest—we don't hide failures. Failed fixes usually need manual review. Regressions suggest the original code had other issues. This data goes to the developer so they know what to investigate next."

---

## Common Objections & Responses

**"Why not just use ESLint?"**
→ ESLint is for style. SORK is semantic security analysis + AI reasoning.

**"Doesn't this require an AI API key?"**
→ No. Works without one using heuristics. Upgrade for better filtering.

**"What if the AI makes a bad fix?"**
→ Keeper catches it. Failed fixes are reported, not silently applied.

**"How fast is it?"**
→ Scan: ~2sec. Triage: ~5sec. Remediate: 2-5 min (AI calls). Verify: ~10sec.

**"What about enterprise?"**
→ BYOK mode = air-gapped, self-hosted. Sorkcloud is managed SaaS with billing.

---

## Files to Know

- `lib/orchestrator.ts` — Main pipeline
- `lib/agents/{triage,remediation,keeper}.ts` — The 3 agents
- `lib/security/scanner.ts` — AST walker
- `lib/config/index.ts` — Configuration logic
- `README.md` — User docs
- `.sork/audit.log` — Audit trail (append-only)

---

## Final Talking Point

"SORK solves a real problem: developers need security scanning that's fast, accurate, and doesn't flood them with false positives. We use AI intelligently—not on every finding, but strategically. And we have fallbacks for every failure mode. It's built to be resilient."

---

**Practice saying these out loud before your interview!** 🎤
