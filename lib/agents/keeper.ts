import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { CodeFix, Vulnerability, VerificationResult, AuditLogEntry } from '../types/index.js';
import { SecurityScanner } from '../security/scanner.js';

const AUDIT_DIR = '.sork';
const AUDIT_FILE = 'audit.log';

export class KeeperAgent {
  private name = 'Agent 03 · K (KEEPER)';
  private logger: Logger;
  private scanner: SecurityScanner;
  private projectPath: string;
  private auditTrail: AuditLogEntry[] = [];

  constructor(logger: Logger, scanner: SecurityScanner, projectPath: string) {
    this.logger = logger;
    this.scanner = scanner;
    this.projectPath = projectPath;
  }

  async verify(fixes: CodeFix[], originalVulns: Vulnerability[]): Promise<VerificationResult> {
    this.logger.info(
      `${this.name} - Verifying ${fixes.length} fix(es) by re-scanning affected files...`
    );

    const results: VerificationResult = {
      verified: [],
      failed: [],
      regressions: [],
    };

    const filesAffected = new Set(fixes.map((f) => f.file));
    const newFindingsByFile = new Map<string, Vulnerability[]>();

    for (const file of filesAffected) {
      const absolute = path.join(this.projectPath, file);
      try {
        const newFindings = await this.scanner.scanFile(absolute);
        newFindingsByFile.set(file, newFindings);
      } catch (err) {
        this.logger.debug(
          `Re-scan failed for ${file}: ${err instanceof Error ? err.message : err}`
        );
        newFindingsByFile.set(file, []);
      }
    }

    for (const fix of fixes) {
      const newFindings = newFindingsByFile.get(fix.file) ?? [];
      const stillPresent = newFindings.some(
        (v) => v.type === fix.type && Math.abs(v.line - fix.line) <= 2
      );

      if (stillPresent) {
        results.failed.push({ fix, reason: 'Vulnerability still present after fix' });
        await this.logAudit('FAILED', fix.type, fix.file, `line ${fix.line}`);
        continue;
      }

      results.verified.push(fix);
      await this.logAudit('FIXED', fix.type, fix.file, fix.description);
    }

    // Anything in the new scan that wasn't in the original list is a regression
    for (const [file, newFindings] of newFindingsByFile) {
      for (const v of newFindings) {
        const wasOriginal = originalVulns.some(
          (o) => o.file === file && o.type === v.type && Math.abs(o.line - v.line) <= 2
        );
        if (!wasOriginal) {
          results.regressions.push(v);
          await this.logAudit('REGRESSION', v.type, file, `line ${v.line}: ${v.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Log AI provider usage to audit trail - called when Cohere or other fallback is used
   */
  async logProviderUsage(
    provider: string,
    action: 'COHERE_USED' | 'COHERE_FALLBACK',
    details?: string,
    tokens?: number
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      type: 'AI_PROVIDER_USAGE',
      file: '',
      details,
      provider,
      tokens,
    };
    this.auditTrail.push(entry);

    try {
      const dir = path.join(this.projectPath, AUDIT_DIR);
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(path.join(dir, AUDIT_FILE), JSON.stringify(entry) + '\n');
    } catch (err) {
      this.logger.debug(`Audit write failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async logAudit(
    action: AuditLogEntry['action'],
    type: string,
    file: string,
    details?: string
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      type,
      file,
      details,
    };
    this.auditTrail.push(entry);

    try {
      const dir = path.join(this.projectPath, AUDIT_DIR);
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(path.join(dir, AUDIT_FILE), JSON.stringify(entry) + '\n');
    } catch (err) {
      this.logger.debug(`Audit write failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  getAuditTrail(): AuditLogEntry[] {
    return this.auditTrail;
  }

  printSummary(results: VerificationResult): void {
    this.logger.section('Keeper Summary');
    console.log(`Verified: ${results.verified.length}`);
    console.log(`Failed:   ${results.failed.length}`);
    console.log(`Regressions: ${results.regressions.length}`);

    if (results.failed.length > 0) {
      this.logger.error('Failed fixes:');
      results.failed.forEach((f) => {
        console.log(`  - ${f.fix.type} in ${f.fix.file}:${f.fix.line} → ${f.reason}`);
      });
    }

    if (results.regressions.length > 0) {
      this.logger.warn('Regressions introduced by fixes:');
      results.regressions.forEach((r) => {
        console.log(`  - [${r.severity}] ${r.type} in ${r.file}:${r.line} → ${r.message}`);
      });
    }

    if (
      results.failed.length === 0 &&
      results.regressions.length === 0 &&
      results.verified.length > 0
    ) {
      this.logger.success('All fixes verified, no regressions');
    }
  }
}
