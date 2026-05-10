import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { Logger } from '../utils/logger.js';
import { Vulnerability, CodeFix } from '../types/index.js';
import { AIProvider, extractCodeBlock } from '../ai/client.js';

const fixSchema = z.object({
  new_code: z.string(),
  description: z.string(),
});

const REMEDIATION_SYSTEM_PROMPT = `You are a senior application security engineer producing safe code rewrites.

Given a vulnerability and the surrounding source, return ONLY a JSON object:
{
  "new_code": "<the exact replacement for the vulnerable region>",
  "description": "<one short sentence explaining the fix>"
}

Rules:
- Preserve all identifiers (variable names, function names) used by the original code.
- Keep the language and style consistent with the surrounding file.
- Do not introduce imports that won't resolve. If you need an import, prefer Node.js built-ins (crypto, path, etc.) or modules already used in the file.
- If a safe automatic fix is not possible, return new_code with a clear TODO comment explaining what the developer must do manually.
- Return ONLY the code that should replace the vulnerable region, not the entire file.
- Do NOT wrap your response in markdown code fences inside the JSON value.`;

export class RemediationAgent {
  private name = 'Agent 02 · O+R (REMEDIATION)';
  private logger: Logger;
  private ai: AIProvider | null;
  private projectPath: string;

  constructor(logger: Logger, ai: AIProvider | null, projectPath: string) {
    this.logger = logger;
    this.ai = ai;
    this.projectPath = projectPath;
  }

  async generateFixes(vulnerabilities: Vulnerability[]): Promise<CodeFix[]> {
    this.logger.info(`${this.name} - Generating fixes for ${vulnerabilities.length} finding(s)...`);

    const fixes: CodeFix[] = [];
    for (const vuln of vulnerabilities) {
      const fix = await this.createFix(vuln);
      if (fix) {
        fixes.push(fix);
      }
    }
    this.logger.success(`Generated ${fixes.length} fix(es)`);
    return fixes;
  }

  private async createFix(vuln: Vulnerability): Promise<CodeFix | null> {
    if (this.ai) {
      const aiFix = await this.aiFix(vuln);
      if (aiFix) {
        return aiFix;
      }
    }
    return this.fallbackFix(vuln);
  }

  private async aiFix(vuln: Vulnerability): Promise<CodeFix | null> {
    try {
      const fileContent = await this.readFile(vuln.file);
      if (!fileContent) {
        return null;
      }

      const oldCode = this.extractRegion(fileContent, vuln);
      const userPrompt = this.buildPrompt(vuln, fileContent, oldCode);

      const result = await this.ai!.chatJSON(REMEDIATION_SYSTEM_PROMPT, userPrompt, fixSchema);
      const newCode = extractCodeBlock(result.new_code);

      return {
        type: vuln.type,
        file: vuln.file,
        line: vuln.line,
        description: result.description,
        oldCode,
        newCode,
        priority: vuln.severity,
      };
    } catch (err) {
      this.logger.debug(
        `AI fix failed for ${vuln.file}:${vuln.line}: ${err instanceof Error ? err.message : err}`
      );
      return null;
    }
  }

  /**
   * Deterministic fallback fixes for cases where AI is unavailable or failed.
   * These are conservative — they prefer leaving a TODO comment over guessing.
   */
  private fallbackFix(vuln: Vulnerability): CodeFix | null {
    const oldCode = vuln.code ?? '';
    const todo = (msg: string): string => `// SORK TODO: ${msg}\n${oldCode}`;

    switch (vuln.type) {
      case 'INSECURE_RANDOM':
        return {
          ...baseFix(vuln, oldCode),
          description: 'Replace Math.random with crypto.randomBytes',
          newCode: oldCode.replace(
            /Math\.random\(\)/g,
            '(parseInt(require("crypto").randomBytes(4).toString("hex"), 16) / 0xffffffff)'
          ),
        };

      case 'XSS':
        return {
          ...baseFix(vuln, oldCode),
          description: 'Use textContent instead of innerHTML',
          newCode: oldCode.replace(/\.(inner|outer)HTML\s*=/, '.textContent ='),
        };

      case 'HARDCODED_SECRET': {
        const match = oldCode.match(/^(\s*(?:const|let|var)\s+)(\w+)(\s*[:=].+?=\s*)['"`].+['"`]/);
        if (match) {
          const [, prefix, name, middle] = match;
          const envName = name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
          return {
            ...baseFix(vuln, oldCode),
            description: `Move secret to process.env.${envName}`,
            newCode: `${prefix}${name}${middle}process.env.${envName} ?? (() => { throw new Error("${envName} required"); })()`,
          };
        }
        return {
          ...baseFix(vuln, oldCode),
          description: 'Hardcoded secret',
          newCode: todo('move this secret to an env var'),
        };
      }

      case 'UNSAFE_EVAL':
      case 'SQL_INJECTION':
      case 'PATH_TRAVERSAL':
      case 'CSRF':
      case 'MISSING_VALIDATION':
        return {
          ...baseFix(vuln, oldCode),
          description: 'Manual review required',
          newCode: todo(
            `${vuln.type} - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually`
          ),
        };

      case 'DEPENDENCY_VULN':
        return null;

      default:
        return null;
    }
  }

  private async readFile(relativePath: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(this.projectPath, relativePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private extractRegion(content: string, vuln: Vulnerability): string {
    if (vuln.range) {
      return content.slice(vuln.range[0], vuln.range[1]);
    }
    const lines = content.split('\n');
    return lines[vuln.line - 1] ?? '';
  }

  private buildPrompt(vuln: Vulnerability, fileContent: string, oldCode: string): string {
    const lines = fileContent.split('\n');
    const start = Math.max(0, vuln.line - 11);
    const end = Math.min(lines.length, (vuln.endLine ?? vuln.line) + 10);
    const context = lines
      .slice(start, end)
      .map((l, i) => `${start + i + 1}: ${l}`)
      .join('\n');

    return [
      `File: ${vuln.file}`,
      `Vulnerability: ${vuln.type} (${vuln.severity})`,
      `Line: ${vuln.line}`,
      `Description: ${vuln.message}`,
      '',
      'The exact code to replace:',
      '```',
      oldCode,
      '```',
      '',
      'Surrounding context:',
      '```',
      context,
      '```',
      '',
      'Return JSON with the safe replacement code.',
    ].join('\n');
  }
}

function baseFix(
  vuln: Vulnerability,
  oldCode: string
): Pick<CodeFix, 'type' | 'file' | 'line' | 'oldCode' | 'priority'> {
  return {
    type: vuln.type,
    file: vuln.file,
    line: vuln.line,
    oldCode,
    priority: vuln.severity,
  };
}
