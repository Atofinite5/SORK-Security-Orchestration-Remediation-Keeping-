import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { Logger } from '../utils/logger.js';
import { Vulnerability, TriageResult, SeverityLevel } from '../types/index.js';
import { AIProvider } from '../ai/client.js';

const triageDecisionSchema = z.object({
  is_real: z.boolean(),
  reason: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
});

const TRIAGE_SYSTEM_PROMPT = `You are a senior application security engineer triaging static analysis findings.

For each finding, decide if it is a REAL vulnerability that needs fixing, or a FALSE POSITIVE that can be dismissed.

Common false positives to dismiss:
- Code inside test/spec files (filename contains .test., .spec., /tests/, /__tests__/)
- Mock data, fixtures, or stub implementations
- Pattern definitions (regex, AST node-name strings) used by linters or scanners themselves
- Examples in documentation
- Intentional security demonstrations clearly marked as such

Do NOT dismiss genuine issues just because they look small. When in doubt, mark is_real=true.

Return ONLY a JSON object:
{
  "is_real": boolean,
  "reason": "one short sentence",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"  // only if you want to override the original
}`;

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0,
};

export class TriageAgent {
  private name = 'Agent 01 · S (TRIAGE)';
  private logger: Logger;
  private ai: AIProvider | null;
  private projectPath: string;

  constructor(logger: Logger, ai: AIProvider | null, projectPath: string) {
    this.logger = logger;
    this.ai = ai;
    this.projectPath = projectPath;
  }

  async analyze(vulnerabilities: Vulnerability[]): Promise<TriageResult> {
    this.logger.info(`${this.name} - Analyzing ${vulnerabilities.length} findings...`);

    const dismissed: Vulnerability[] = [];
    const confirmed: Vulnerability[] = [];

    for (const vuln of vulnerabilities) {
      const decision = await this.decide(vuln);
      if (decision.dismiss) {
        dismissed.push({ ...vuln, dismissedReason: decision.reason });
        this.logger.debug(`Dismissed: ${vuln.type} ${vuln.file}:${vuln.line} (${decision.reason})`);
      } else {
        const adjusted = decision.severity ? { ...vuln, severity: decision.severity } : vuln;
        confirmed.push(adjusted);
      }
    }

    confirmed.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    return { dismissed, confirmed };
  }

private async decide(vuln: Vulnerability): Promise<{
    dismiss: boolean;
    reason?: string;
    severity?: SeverityLevel;
  }> {
    const heuristic = this.heuristicDismiss(vuln);
    if (heuristic) {
      return { dismiss: true, reason: heuristic };
    }

    // Auto-confirm vulnerabilities in test fixture files - no AI needed
    if (this.shouldAutoConfirm(vuln)) {
      return { dismiss: false, reason: 'Test fixture showing real vulnerability' };
    }

    if (!this.ai) {
      return { dismiss: false };
    }

    try {
      const context = await this.loadContext(vuln);
      const userPrompt = this.buildUserPrompt(vuln, context);
      const decision = await this.ai.chatJSON(
        TRIAGE_SYSTEM_PROMPT,
        userPrompt,
        triageDecisionSchema
      );

      return {
        dismiss: !decision.is_real,
        reason: decision.reason,
        severity: decision.severity,
      };
    } catch (err) {
      this.logger.debug(
        `AI triage failed for ${vuln.file}:${vuln.line}: ${err instanceof Error ? err.message : err}`
      );
      return { dismiss: false };
    }
  }

private heuristicDismiss(vuln: Vulnerability): string | null {
    // Only dismiss actual test definition files (*.test.ts, *.spec.ts)
    // Real vulnerabilities in test fixtures (like tests/fixtures/) should NOT be dismissed
    // because they might indicate real security issues in the test setup
    if (/\b(\.test\.|\.spec\.)/.test(vuln.file)) {
      return 'In test definition file';
    }

    // No heuristic dismissal - proceed to AI triage or auto-confirm
    return null;
  }

  /**
   * Auto-confirm vulnerabilities in files that are explicitly demonstrating security issues.
   * These are intentional vulnerability patterns that users want to detect.
   */
  private shouldAutoConfirm(vuln: Vulnerability): boolean {
    const file = vuln.file.toLowerCase();
    // Files with "vulnerable" in the name are test fixtures showing real issues
    if (file.includes('vulnerable')) {
      return true;
    }
    // Files with "bad" or "insecure" in the name are also test patterns
    if (file.includes('bad') || file.includes('insecure') || file.includes('hack')) {
      return true;
    }
    return false;
  }

  private async loadContext(vuln: Vulnerability): Promise<string> {
    try {
      const filePath = path.join(this.projectPath, vuln.file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, vuln.line - 6);
      const end = Math.min(lines.length, (vuln.endLine ?? vuln.line) + 5);
      return lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    } catch {
      return vuln.code ?? '(context unavailable)';
    }
  }

  private buildUserPrompt(vuln: Vulnerability, context: string): string {
    return [
      `File: ${vuln.file}`,
      `Line: ${vuln.line}`,
      `Type: ${vuln.type}`,
      `Severity: ${vuln.severity}`,
      `Detector message: ${vuln.message}`,
      '',
      'Surrounding code:',
      '```',
      context,
      '```',
    ].join('\n');
  }
}
