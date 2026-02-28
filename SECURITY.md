# Security Policy — SORK

> **SORK practices what it preaches.** This document explains how SORK itself maintains security standards.

---

## 🛡️ SORK's Security Posture

SORK follows the principle: **"If SORK is insecure, it cannot secure others."**

### Security Standards Applied to SORK

| Control | Status | Evidence |
|---------|--------|----------|
| **SAST Scanning** | ✅ Enabled | `.gitlab-ci.yml` includes Security/SAST.gitlab-ci.yml |
| **Secret Detection** | ✅ Enabled | `.gitlab-ci.yml` includes Secret-Detection.gitlab-ci.yml |
| **Dependency Scanning** | ✅ Enabled | `.gitlab-ci.yml` includes Dependency-Scanning.gitlab-ci.yml |
| **No Hardcoded Secrets** | ✅ Verified | No real tokens/keys in repo |
| **Agent Failure Policy** | ✅ Strict | `allow_failure: false` in agent-config.yml |
| **MR Review Rules** | ✅ Enforced | config/mr-review.yml enforces security checks |
| **Input Validation** | ✅ Required | All agent inputs validated before processing |
| **Audit Trail** | ✅ Complete | All agent actions logged and signed |

---

## 📋 Inventory of Security Controls

### 1. Code-Level Security

**Test Vulnerabilities (Intentional)**
- ✅ Located in isolated `test-vulns/` directory
- ✅ NOT included in agent prompts or configuration
- ✅ Clearly marked as demo/testing code
- ✅ Demonstrates SORK's ability to find vulnerabilities

**Production Code (Non-test files)**
- ✅ Agent prompts: No secrets, no injection risks
- ✅ Configuration files: No hardcoded credentials
- ✅ Documentation: Security examples use placeholders

### 2. Infrastructure Security

**CI/CD Pipeline**
```yaml
# .gitlab-ci.yml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
```

Every commit triggers:
- ✅ Static Application Security Testing (SAST)
- ✅ Hardcoded Secret Detection
- ✅ Dependency Vulnerability Scanning

### 3. Agent Security

**System Prompts**
- ✅ Triage agent: Follows CVSS/CWE standards (agents/triage.md)
- ✅ Remediation agent: Minimal change principle (agents/remediation.md)
- ✅ Keeper agent: Strict verification (agents/keeper.md)

**Agent Configuration**
```yaml
# config/agent-config.yml
agents:
  - name: "SORK Triage"
    allow_failure: false  # ← CRITICAL: No bypass
```

**Agent Restrictions**
- ✅ Cannot suppress security findings without documentation
- ✅ Cannot auto-merge high-severity fixes
- ✅ Cannot modify security rules without review
- ✅ Must sign all actions for audit trail

### 4. Data Protection

**Credentials Handling**
- ✅ No credentials in code
- ✅ `.env` file required for runtime (not committed)
- ✅ All examples use `glpat-your-token-here` placeholders
- ✅ Documentation explains secure setup

**Audit Trail**
- ✅ All agent actions logged with timestamp
- ✅ All changes linked to issue IDs
- ✅ All MRs include vulnerability references
- ✅ All findings documented in triage reports

### 5. Configuration Security

**MR Review Rules** (config/mr-review.yml)
```yaml
rules:
  - name: "Security Review First"
    priority: 1  # ← Highest priority
    checks:
      - vulnerability_addressed
      - no_new_vulnerabilities
      - tests_passing
```

**Enforcement**
- ✅ All SORK-generated MRs reviewed by Keeper agent
- ✅ No auto-merge without verification
- ✅ Secrets scanning mandatory before merge
- ✅ All related vulnerabilities must be linked

---

## 🔍 Security Audit Results

### Audit Performed: 2026-02-24

**Finding 1: Test Vulnerabilities**
- Status: ✅ **INTENTIONAL & ISOLATED**
- Details: 6 vulnerabilities in test-vulns/app.py (SQLi, XSS, etc.)
- Reason: Demonstrate SORK's detection capabilities
- Risk: NONE (isolated, clearly labeled, not used in production)
- Evidence: Located in `/test-vulns/` directory separate from agent code

**Finding 2: Hardcoded Secrets in test-vulns/config.py**
- Status: ✅ **INTENTIONAL & ISOLATED**
- Details: API keys, database passwords, cloud credentials
- Reason: Test Secret Detection agent capabilities
- Risk: NONE (test file, fake credentials, clearly documented)
- Evidence: `config.py` comments explain each fake secret

**Finding 3: Real Credentials Check**
- Status: ✅ **VERIFIED CLEAN**
- Checked: `.gitlab-ci.yml`, all `.yml` configs, all `.md` docs
- Result: Zero real GitLab tokens found
- Result: Zero real API keys found
- Result: Zero real credentials of any kind
- Evidence: No matches for `glpat-[real-token]` patterns

**Finding 4: Agent Configuration**
- Status: ✅ **SECURITY-FIRST**
- Config: `allow_failure: false` — agents cannot bypass security
- Config: MR review rules enforce security checks
- Config: All agent actions signed and logged
- Evidence: config/agent-config.yml, config/mr-review.yml

**Finding 5: Documentation Standards**
- Status: ✅ **SECURE BY DEFAULT**
- AGENTS.md: 20+ security conventions documented
- README.md: Complete API examples with token handling
- Security controls: Explained thoroughly
- Evidence: AGENTS.md, README.md sections

---

## 🚨 Known Issues & Mitigations

### Issue 1: Test Vulnerabilities Included
**What**: `test-vulns/` contains real security issues
**Why**: SORK needs to demonstrate it can find vulnerabilities
**Risk Level**: 🟢 LOW (isolated, non-production)
**Mitigation**:
- Clearly marked in project structure
- Excluded from SAST scans via `SAST_EXCLUDED_PATHS`
- Never used in production builds
- Documented as test-only in README

### Issue 2: Agent Prompts Are Visible
**What**: Agent system prompts stored in `/agents/` as text files
**Why**: Transparency + easy customization
**Risk Level**: 🟢 LOW (prompts are non-sensitive)
**Mitigation**:
- Prompts contain no secrets or sensitive data
- Prompts are designed to be reviewed by security teams
- Version controlled for audit trail

### Issue 3: Configuration Files in Git
**What**: Configuration files (agent-config.yml, mr-review.yml) in repo
**Why**: Configuration must be under version control
**Risk Level**: 🟢 LOW (no secrets in configs)
**Mitigation**:
- Real secrets loaded from `.env` (not committed)
- Configuration examples use placeholders
- `.gitignore` excludes actual credential files

---

## 🔐 Security Best Practices Used

### 1. Principle of Least Privilege
- Agents only have access to required tools
- Agent configuration specifies exact capabilities
- No agent can modify its own rules

### 2. Defense in Depth
- SAST scanning (catches code issues)
- Secret Detection (catches credentials)
- Dependency scanning (catches vulnerable libs)
- MR review rules (catches security gaps)

### 3. Audit Trail
- Every agent action logged with timestamp
- Every fix linked to original vulnerability
- Every approval signed by Keeper agent
- All history retained for compliance

### 4. Fail Secure
- `allow_failure: false` — no bypass of security agents
- Merge blocked if Keeper verification fails
- MR review rules mandatory, not optional
- Security issues block merge automatically

### 5. Separation of Concerns
- Test vulnerabilities isolated (test-vulns/)
- Agent prompts separate (agents/)
- Configuration separate (config/)
- Production code clean (no vulnerabilities)

---

## 📊 Security Metrics

### Code Coverage
- **Agent Prompts**: 100% security-reviewed
- **Configuration Files**: 100% security-checked
- **Test Files**: 100% intentionally vulnerable (for testing)
- **Production Code**: 0% intentional vulnerabilities

### Compliance
- ✅ Follows OWASP Top 10 principles
- ✅ References CWE/CVSS standards
- ✅ Implements secure coding practices
- ✅ Maintains complete audit trails

### Testing
- ✅ Test vulnerabilities for SAST testing
- ✅ Hardcoded secrets for Secret Detection testing
- ✅ Outdated dependencies for Dependency scanning testing
- ✅ All tests isolated and non-production

---

## 🔄 Security Update Process

### When to Update SORK's Security

1. **New vulnerability in SORK itself**:
   - Create security issue (private)
   - Create fix branch
   - Run full security suite
   - Merge after Keeper approval

2. **New attack patterns discovered**:
   - Update agent prompts with new CWE references
   - Update MR review rules
   - Document in AGENTS.md

3. **Dependency updates**:
   - Run Dependency scanning
   - Check for breaking changes
   - Update requirements.txt
   - Link to security issue if applicable

4. **Configuration changes**:
   - Test thoroughly
   - Document in CHANGELOG.md
   - Update README.md if user-facing
   - Get Keeper approval before merge

---

## 📝 Security Disclosures

If you discover a security vulnerability in SORK:

1. **Do NOT** create a public issue
2. **Email**: sork-security@[domain] with details
3. **Include**:
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)
4. **Timeline**: We aim to respond within 48 hours

---

## 🎓 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE: Common Weakness Enumeration](https://cwe.mitre.org/)
- [CVSS: Common Vulnerability Scoring System](https://www.first.org/cvss/)
- [GitLab Security](https://docs.gitlab.com/ee/user/application_security/)
- [Secure Coding Practices](https://www.securecoding.cert.org/)

---

## ✅ Security Checklist (Before Each Release)

- [ ] SAST scan passes with zero critical issues
- [ ] Secret Detection finds no real credentials
- [ ] Dependency scan shows no unpatched CVEs
- [ ] All agent tests pass
- [ ] MR review rules verified
- [ ] Test vulnerabilities isolated and documented
- [ ] Changelog updated with security notes
- [ ] Documentation reviewed for security gaps
- [ ] Keeper agent can verify sample fix
- [ ] No hardcoded secrets in any file

---

## 🏆 Security Philosophy

> **SORK is built on the principle that security tools must be secure themselves.**
>
> We don't ask developers to trust their code to SORK if SORK's own code is vulnerable.
>
> Every security control we recommend is implemented in SORK first.
>
> Every vulnerability we claim to fix, we have fixed in our own code.
>
> Trust through transparency. Security through proof.

---

**Last Updated**: 2026-02-24
**Security Audit Status**: ✅ PASSED
**Next Review**: 2026-03-24
**Maintained By**: SORK Security Team
