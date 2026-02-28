import { Logger } from '../utils/logger.js';
import { Vulnerability, CodeFix, VulnerabilityType } from '../types/index.js';

export class RemediationAgent {
  private name: string = 'Agent 02 · O+R (REMEDIATION)';
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async generateFixes(vulnerabilities: Vulnerability[]): Promise<CodeFix[]> {
    this.logger.info(`${this.name} - Generating targeted fixes...`);

    const fixes: CodeFix[] = [];

    for (const vuln of vulnerabilities) {
      const fix = this.createFix(vuln);
      if (fix) {
        fixes.push(fix);
      }
    }

    this.logger.success(`Generated ${fixes.length} fixes`);
    return fixes;
  }

  private createFix(vuln: Vulnerability): CodeFix | null {
    const fixGenerators: Record<VulnerabilityType, () => CodeFix | null> = {
      SQL_INJECTION: () => ({
        type: 'SQL_INJECTION',
        file: vuln.file,
        line: vuln.line,
        description: 'Use parameterized queries instead of string concatenation',
        oldCode: vuln.code || '',
        newCode: `const query = 'SELECT * FROM users WHERE id = ?';\ndb.execute(query, [userId]);`,
        priority: 'CRITICAL',
      }),
      XSS: () => ({
        type: 'XSS',
        file: vuln.file,
        line: vuln.line,
        description: 'Sanitize user input or use textContent instead of innerHTML',
        oldCode: vuln.code || '',
        newCode: `element.textContent = userInput;`,
        priority: 'CRITICAL',
      }),
      HARDCODED_SECRET: () => ({
        type: 'HARDCODED_SECRET',
        file: vuln.file,
        line: vuln.line,
        description: 'Move secret to environment variable',
        oldCode: vuln.code || '',
        newCode: `const apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error('API_KEY required');`,
        priority: 'CRITICAL',
      }),
      INSECURE_RANDOM: () => ({
        type: 'INSECURE_RANDOM',
        file: vuln.file,
        line: vuln.line,
        description: 'Use crypto.randomBytes instead of Math.random',
        oldCode: vuln.code || '',
        newCode: `import { randomBytes } from 'crypto';\nconst token = randomBytes(32).toString('hex');`,
        priority: 'HIGH',
      }),
      MISSING_VALIDATION: () => ({
        type: 'MISSING_VALIDATION',
        file: vuln.file,
        line: vuln.line,
        description: 'Add input validation before processing',
        oldCode: vuln.code || '',
        newCode: `const schema = z.object({ email: z.string().email() });\nconst validated = schema.parse(userInput);`,
        priority: 'HIGH',
      }),
      PATH_TRAVERSAL: () => ({
        type: 'PATH_TRAVERSAL',
        file: vuln.file,
        line: vuln.line,
        description: 'Validate and normalize file paths',
        oldCode: vuln.code || '',
        newCode: `const basePath = path.resolve('./uploads');\nconst userPath = path.resolve('./uploads', userInput);\nif (!userPath.startsWith(basePath)) throw new Error('Invalid path');`,
        priority: 'HIGH',
      }),
      UNSAFE_EVAL: () => ({
        type: 'UNSAFE_EVAL',
        file: vuln.file,
        line: vuln.line,
        description: 'Replace eval with safer alternatives',
        oldCode: vuln.code || '',
        newCode: `const data = JSON.parse(userInput);`,
        priority: 'CRITICAL',
      }),
      CSRF: () => ({
        type: 'CSRF',
        file: vuln.file,
        line: vuln.line,
        description: 'Add CSRF token validation',
        oldCode: vuln.code || '',
        newCode: `if (!req.csrfToken() || req.body._csrf !== req.csrfToken()) {\n  return res.status(403).send('CSRF validation failed');\n}`,
        priority: 'HIGH',
      }),
      DEPENDENCY_VULN: () => null,
    };

    const generator = fixGenerators[vuln.type];
    return generator ? generator() : null;
  }
}
