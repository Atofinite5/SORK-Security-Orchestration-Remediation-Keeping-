import { Logger } from '../utils/logger.js';
import { Vulnerability, TriageResult } from '../types/index.js';

export class TriageAgent {
  private name: string = 'Agent 01 · S (TRIAGE)';
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async analyze(vulnerabilities: Vulnerability[]): Promise<TriageResult> {
    this.logger.info(
      `${this.name} - Analyzing ${vulnerabilities.length} findings...`
    );

    const dismissed: Vulnerability[] = [];
    const confirmed: Vulnerability[] = [];

    for (const vuln of vulnerabilities) {
      const fpResult = this.isFalsePositive(vuln);
      if (fpResult.isFalsePositive) {
        const dismissedVuln = { ...vuln, dismissedReason: fpResult.reason };
        dismissed.push(dismissedVuln);
        this.logger.debug(
          `Dismissed false positive: ${vuln.type} in ${vuln.file} (${fpResult.reason})`
        );
      } else {
        confirmed.push(vuln);
      }
    }

    confirmed.sort((a, b) => {
      const severityMap: Record<string, number> = {
        CRITICAL: 3,
        HIGH: 2,
        MEDIUM: 1,
        LOW: 0,
      };
      return (severityMap[b.severity] || 0) - (severityMap[a.severity] || 0);
    });

    this.logger.info(`${dismissed.length} false positives dismissed`);
    this.logger.warn(`${confirmed.length} confirmed threats`);

    return { dismissed, confirmed };
  }

  private isFalsePositive(vuln: Vulnerability): {
    isFalsePositive: boolean;
    reason?: string;
  } {
    const patterns = [
      {
        pattern: /\b(test|spec|\.test\.|\.spec\.)/,
        property: 'file' as const,
        reason: 'Test file',
      },
      {
        pattern: /\b(mock|fixture|stub)\b/,
        property: 'message' as const,
        reason: 'Mock data',
      },
      {
        pattern: /\bas\s+(unknown|any|const)\b|@ts-ignore/,
        property: 'message' as const,
        reason: 'Intentional type bypass',
      },
    ];

    for (const check of patterns) {
      const value = vuln[check.property];
      if (typeof value === 'string' && check.pattern.test(value)) {
        return { isFalsePositive: true, reason: check.reason };
      }
    }

    return { isFalsePositive: false };
  }
}
