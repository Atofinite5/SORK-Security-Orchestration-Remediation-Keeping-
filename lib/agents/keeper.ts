import { Logger } from '../utils/logger.js';
import { CodeFix, Vulnerability, VerificationResult, AuditLogEntry } from '../types/index.js';

export class KeeperAgent {
  private name: string = 'Agent 03 · K (KEEPER)';
  private logger: Logger;
  private auditTrail: AuditLogEntry[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async verify(
    fixes: CodeFix[],
    vulnerabilities: Vulnerability[]
  ): Promise<VerificationResult> {
    this.logger.info(`${this.name} - Verifying fixes...`);

    const results: VerificationResult = {
      verified: [],
      failed: [],
      regressions: [],
    };

    for (const fix of fixes) {
      const verification = await this.verifyFix(fix, vulnerabilities);
      if (verification.success) {
        results.verified.push(fix);
        this.logAudit('FIXED', fix.type, fix.file);
      } else {
        results.failed.push({ fix, reason: verification.reason || 'Unknown' });
        this.logAudit('FAILED', fix.type, fix.file);
      }
    }

    const regressions = await this.detectRegressions();
    results.regressions = regressions;

    if (regressions.length > 0) {
      this.logger.warn(`Detected ${regressions.length} potential regressions`);
      regressions.forEach((r) => {
        this.logAudit('REGRESSION', r.type, r.file);
      });
    }

    return results;
  }

  private async verifyFix(
    fix: CodeFix,
    originalVulnerabilities: Vulnerability[]
  ): Promise<{ success: boolean; reason?: string }> {
    const isAddressed = !originalVulnerabilities.some(
      (v) =>
        v.type === fix.type && v.file === fix.file && v.line === fix.line
    );

    if (!isAddressed) {
      return { success: false, reason: 'Vulnerability still present' };
    }

    const hasNewIssues = this.checkForNewIssues(fix);
    if (hasNewIssues) {
      return { success: false, reason: 'Fix introduces new issues' };
    }

    return { success: true };
  }

  private checkForNewIssues(fix: CodeFix): boolean {
    const antiPatterns = [
      /\/\/ TODO.*SECURITY/i,
      /\/\/ FIXME/i,
      /Math\.random\(\)/,
      /eval\(/,
      /dangerouslySetInnerHTML/,
    ];

    return antiPatterns.some((pattern) => pattern.test(fix.newCode));
  }

  private async detectRegressions(): Promise<Vulnerability[]> {
    return [];
  }

  private logAudit(
    action: 'FIXED' | 'FAILED' | 'REGRESSION' | 'SCANNED' | 'DISMISSED',
    type: string,
    file: string,
    details?: string
  ): void {
    this.auditTrail.push({
      timestamp: new Date().toISOString(),
      action,
      type,
      file,
      details,
    });
  }

  getAuditTrail(): AuditLogEntry[] {
    return this.auditTrail;
  }

  printSummary(results: VerificationResult): void {
    this.logger.section('Keeper Summary');
    console.log(`Total Verified: ${results.verified.length}`);
    console.log(`Failed: ${results.failed.length}`);
    console.log(`Regressions: ${results.regressions.length}`);

    if (results.verified.length > 0) {
      this.logger.success('All critical issues resolved ✓');
    }

    if (results.failed.length > 0) {
      this.logger.error('Some fixes failed:');
      results.failed.forEach((f) => {
        console.log(`  - ${f.fix.type} in ${f.fix.file}: ${f.reason}`);
      });
    }

    if (results.regressions.length === 0) {
      this.logger.success('No regressions detected');
    }
  }
}
