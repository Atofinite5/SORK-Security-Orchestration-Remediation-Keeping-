# SORK — Security Orchestration, Remediation & Keeping

A **global Node.js security brain** that automatically scans, fixes, and verifies code vulnerabilities in your projects. Works directly as an npm module and git pre-commit hook.

```
███████╗  ██████╗  ██████╗  ██╗  ██╗
██╔════╝ ██╔═══██╗ ██╔══██╗ ██║ ██╔╝
███████╗ ██║   ██║ ██████╔╝ █████╔╝
╚════██║ ██║   ██║ ██╔══██╗ ██╔═██╗
███████║ ╚██████╔╝ ██║  ██║ ██║  ██╗
╚══════╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝
```

## Features

✅ **Three-Agent System**
- **Agent 01 (TRIAGE)**: Analyzes vulnerabilities, dismisses false positives
- **Agent 02 (REMEDIATION)**: Generates targeted code fixes
- **Agent 03 (KEEPER)**: Verifies fixes and catches regressions

✅ **Auto-Fix Everything**
- SQL Injection, XSS, CSRF
- Hardcoded secrets
- Insecure randomness
- Missing validation
- Path traversal
- Unsafe eval()

✅ **Pre-Commit Guards**
- Blocks commits with critical vulnerabilities
- Prevents secrets from being committed
- Auto-fixes issues before commit

✅ **TypeScript Native**
- Full type safety
- ES modules
- Zero runtime overhead

## Installation

### Global (Recommended)
```bash
npm install -g @sork/orchestrator
```

Then in any Node project:
```bash
sork init
sork setup-hooks
```

### Local (Per Project)
```bash
npm install --save-dev @sork/orchestrator
```

## Usage

### Initialize SORK in Your Project
```bash
sork init
```

Creates `.sorkrc.json` configuration and `.sork/` directory.

### Run Security Scan
```bash
sork scan
```

Outputs:
```
SORK Security Scan
──────────────────────────────────────────────────

Agent 01 (TRIAGE) - Analyzing project...
Detected 12 potential issues

4 false positives dismissed
8 confirmed threats

Confirmed Vulnerabilities
──────────────────────────────────────────────────
1. [CRITICAL] SQL_INJECTION
   File: src/database.ts:45
   Issue: Potential SQL injection - use parameterized queries

2. [HIGH] XSS
   File: src/api.ts:120
   Issue: Potential XSS vulnerability - avoid innerHTML with user input
...
```

### Auto-Fix Issues
```bash
sork fix
```

SORK will:
1. **Generate targeted fixes** for each vulnerability
2. **Apply fixes** to your code
3. **Verify fixes** didn't introduce new issues
4. **Format code** with Prettier
5. **Run linting** with ESLint

### Pre-Commit Hooks
```bash
sork setup-hooks
```

Installs `.git/hooks/pre-commit` that automatically:
- Runs security scan on staged files
- Blocks commits with CRITICAL issues
- Suggests fixes for HIGH issues

Developers can still commit by running `sork fix` first.

### Check Status
```bash
sork status
```

Shows agents status, configuration, and audit trail.

## How It Works

### The 3-Agent Flow

```
[CODE]
  ↓
[SCAN] → Detect vulnerabilities
  ↓
[AGENT 01: TRIAGE] → Dismiss false positives, confirm threats
  ↓
[AGENT 02: REMEDIATION] → Generate targeted fixes
  ↓
[AGENT 03: KEEPER] → Verify fixes, catch regressions
  ↓
[FIXED CODE]
```

### What SORK Fixes

| Issue | Fix |
|-------|-----|
| `SELECT * FROM users WHERE id = ` + userId | Use parameterized queries |
| `element.innerHTML = userInput` | Use `.textContent` or sanitize |
| `apiKey = "sk_live_..."` | Move to env var |
| `Math.random()` for tokens | Use `crypto.randomBytes()` |
| `eval(userCode)` | Use `Function()` or JSON.parse |
| No input validation | Add schema validation |
| `/uploads/` + userPath | Validate & normalize paths |
| No CSRF token | Add CSRF middleware |

### False Positive Detection

SORK automatically dismisses false positives:
- Vulnerabilities in test files
- Code in comments
- Type assertions (`as unknown`, `@ts-ignore`)
- Mock data

## Configuration

Edit `.sorkrc.json`:

```json
{
  "version": "1.0.0",
  "agents": {
    "triage": true,
    "remediation": true,
    "keeper": true
  },
  "settings": {
    "autoFix": true,
    "preCommitGuards": true,
    "strictMode": false
  }
}
```

## Using as a Module

```typescript
import { SorkOrchestrator } from '@sork/orchestrator';

const sork = new SorkOrchestrator({
  projectPath: './my-project',
  model: 'anthropic',
});

// Scan
await sork.scan();

// Auto-fix
await sork.fix();

// Pre-commit check
await sork.preCommit();
```

## Command Reference

```bash
sork init                 # Initialize SORK
sork scan                 # Security scan
sork fix                  # Auto-fix issues
sork pre-commit           # Pre-commit check
sork setup-hooks          # Install git hooks
sork status               # Show status

# Options
sork scan --path ./src    # Scan specific directory
sork fix --model anthropic # Use specific AI model
```

## How Contributors Use It

### For Developers

1. **Install globally once**
   ```bash
   npm install -g @sork/orchestrator
   sork setup-hooks
   ```

2. **Code normally** — no changes to workflow

3. **Try to commit** — SORK pre-commit hook runs automatically
   ```bash
   git commit -m "Add payment feature"
   # ↓ SORK runs automatically
   # ERROR: CRITICAL SQL injection detected in payment.ts:45
   # Commit blocked. Run `sork fix` to auto-resolve.
   ```

4. **Auto-fix or fix manually**
   ```bash
   sork fix
   # ✓ Applied SQL_INJECTION fix
   # ✓ Applied XSS fix
   # Run git commit again to try again
   ```

5. **Commit succeeds**
   ```bash
   git commit -m "Add payment feature"
   # ✓ All security checks passed
   # [feature/payment 1a2b3c4] Add payment feature
   ```

### For Code Reviewers

SORK audit trail available:
```bash
sork status
# Shows: 12 scanned, 4 dismissed, 8 fixed, 0 remaining
```

## The Three Agents

### Agent 01: TRIAGE (S)
- Analyzes all findings
- Dismisses false positives with explanations
- Prioritizes by severity (CRITICAL → HIGH → MEDIUM → LOW)
- Confirms real threats

**Tools:**
- list_vulns
- get_details
- dismiss
- confirm
- read_file

### Agent 02: REMEDIATION (O+R)
- Generates targeted fixes (not generic replacements)
- Creates minimal code changes (zero unnecessary modifications)
- Links fixes to vulnerabilities
- Writes human-readable fixed code

**Tools:**
- read_file
- edit_file
- create_fix
- link_vuln
- format_code

### Agent 03: KEEPER (K)
- Monitors fix pipelines
- Verifies each fix resolved the issue
- Catches regressions
- Maintains security audit trail

**Tools:**
- get_fix_status
- pipeline_errors
- security_findings
- verify_fix
- log_audit

## Environment Variables

```bash
DEBUG=1           # Enable debug logging
SORK_MODEL=local  # Use local model instead of Anthropic
SORK_STRICT=true  # Fail on warnings (not just errors)
```

## TypeScript Support

SORK is **100% TypeScript**. Full type safety:

```typescript
import type { Vulnerability, CodeFix } from '@sork/orchestrator';

const vuln: Vulnerability = {
  type: 'SQL_INJECTION',
  file: 'src/db.ts',
  line: 45,
  message: 'Use parameterized queries',
  severity: 'CRITICAL',
};

const fix: CodeFix = {
  type: 'SQL_INJECTION',
  file: 'src/db.ts',
  line: 45,
  description: 'Use parameterized queries',
  oldCode: 'SELECT * FROM users WHERE id = ' + userId,
  newCode: 'db.query("SELECT * FROM users WHERE id = ?", [userId])',
  priority: 'CRITICAL',
};
```

## Global npm Install (For All Projects)

```bash
# Build locally
npm run build

# Install globally
npm run global

# Now available everywhere
cd ~/any-project
sork init
sork scan
```

## Performance

- **Scan**: ~1-2s for typical project
- **Fix**: ~2-3s to generate and apply fixes
- **Pre-commit**: <500ms for staged files only

## Supported Vulnerabilities

- [x] SQL Injection
- [x] Cross-Site Scripting (XSS)
- [x] Cross-Site Request Forgery (CSRF)
- [x] Hardcoded Secrets
- [x] Insecure Randomness
- [x] Path Traversal
- [x] Unsafe eval()
- [x] Missing Validation
- [ ] Dependency vulnerabilities (coming soon)
- [ ] Authentication bypass (coming soon)

## Troubleshooting

### Hooks not running
```bash
# Reinstall hooks
sork setup-hooks

# Verify
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### False positives
Edit `.sorkrc.json` to exclude patterns:
```json
{
  "settings": {
    "excludePatterns": [
      "**/test/**",
      "**/mock/**"
    ]
  }
}
```

### Need help
```bash
sork --help
DEBUG=1 sork scan
```

## License

MIT — Use freely in your projects!

## Author

Bhargav Kalambhe (@bhargavkalambhe)

---

**SORK: Your code's security brain.** 🧠🔐
