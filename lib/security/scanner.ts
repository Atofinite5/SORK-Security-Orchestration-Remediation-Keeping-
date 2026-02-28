import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { Vulnerability } from '../types/index.js';

export class SecurityScanner {
  private projectPath: string;
  private logger: Logger;

  constructor(projectPath: string, logger: Logger) {
    this.projectPath = projectPath;
    this.logger = logger;
  }

  async scan(): Promise<Vulnerability[]> {
    this.logger.info('Scanning project for vulnerabilities...');
    const vulnerabilities: Vulnerability[] = [];

    try {
      const jsVulns = await this.scanJavaScript();
      vulnerabilities.push(...jsVulns);

      const secretVulns = await this.scanSecrets();
      vulnerabilities.push(...secretVulns);

      const depVulns = await this.scanDependencies();
      vulnerabilities.push(...depVulns);
    } catch (error) {
      this.logger.error(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return vulnerabilities;
  }

  async scanStaged(): Promise<Vulnerability[]> {
    try {
      const stagedFiles = await this.getStagedFiles();
      if (stagedFiles.length === 0) {
        this.logger.debug('No staged files found to scan');
        return [];
      }
      return this.scanFiles(stagedFiles);
    } catch (error) {
      this.logger.error(
        `Failed to scan staged files: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return [];
    }
  }

  private async scanJavaScript(): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    try {
      const files = await this.findFiles('**/*.{ts,tsx,js,jsx}', [
        'node_modules',
        'dist',
        '.git',
      ]);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const fileVulns = this.checkJavaScriptPatterns(content, file);
        vulnerabilities.push(...fileVulns);
      }
    } catch (error) {
      this.logger.debug(`Failed to scan JavaScript: ${error}`);
    }

    return vulnerabilities;
  }

  private checkJavaScriptPatterns(content: string, file: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    const lines = content.split('\n');

    const sqlPattern = /sql\s*=\s*['"]/i;
    const innerHTMLPattern = /innerHTML\s*=/i;
    const dangerousPattern = /dangerouslySetInnerHTML/i;
    const evalPattern = /\beval\s*\(/i;
    const passwordPattern = /password\s*=\s*['"]/i;
    const apiKeyPattern = /api[_-]?key\s*=\s*['"]/i;
    const secretPattern = /\b(secret|token)\s*=\s*['"]/i;
    const mathRandomPattern = /Math\.random\s*\(\)/i;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || !trimmedLine) {
        return;
      }

      if (sqlPattern.test(line)) {
        vulnerabilities.push({
          type: 'SQL_INJECTION',
          file,
          line: lineNum,
          column: line.indexOf('sql'),
          message: 'Potential SQL injection - use parameterized queries',
          code: trimmedLine,
          severity: 'HIGH',
        });
      }

      if (innerHTMLPattern.test(line) || dangerousPattern.test(line)) {
        const column = Math.max(line.indexOf('innerHTML'), line.indexOf('dangerously'));
        vulnerabilities.push({
          type: 'XSS',
          file,
          line: lineNum,
          column: column >= 0 ? column : 0,
          message: 'Potential XSS vulnerability - avoid innerHTML with user input',
          code: trimmedLine,
          severity: 'HIGH',
        });
      }

      if (passwordPattern.test(line) || apiKeyPattern.test(line) || secretPattern.test(line)) {
        vulnerabilities.push({
          type: 'HARDCODED_SECRET',
          file,
          line: lineNum,
          column: 0,
          message: 'Hardcoded secret detected - move to environment variable',
          code: trimmedLine,
          severity: 'CRITICAL',
        });
      }

      if (evalPattern.test(line)) {
        vulnerabilities.push({
          type: 'UNSAFE_EVAL',
          file,
          line: lineNum,
          column: line.indexOf('eval'),
          message: 'Use of eval() is dangerous - use safer alternatives',
          code: trimmedLine,
          severity: 'CRITICAL',
        });
      }

      if (mathRandomPattern.test(line)) {
        vulnerabilities.push({
          type: 'INSECURE_RANDOM',
          file,
          line: lineNum,
          column: line.indexOf('Math'),
          message: 'Math.random() is not cryptographically secure - use crypto module',
          code: trimmedLine,
          severity: 'HIGH',
        });
      }
    });

    return vulnerabilities;
  }

  private async scanSecrets(): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const secretPatterns = [
        /api.?key\s*[=:]\s*['"]/i,
        /api.?secret\s*[=:]\s*['"]/i,
        /password\s*[=:]\s*['"]/i,
        /\btoken\s*[=:]\s*['"]/i,
        /auth.?secret\s*[=:]\s*['"]/i,
        /private.?key\s*[=:]\s*['"]/i,
      ];

      const files = await this.findFiles('**/*', ['node_modules', 'dist', '.git']);

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (secretPatterns.some((p) => p.test(line))) {
              vulnerabilities.push({
                type: 'HARDCODED_SECRET',
                file,
                line: index + 1,
                column: 0,
                message: 'Potential hardcoded secret detected',
                severity: 'CRITICAL',
              });
            }
          });
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to scan secrets: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return vulnerabilities;
  }

  private async scanDependencies(): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');

      let packageJson: Record<string, unknown>;
      try {
        packageJson = JSON.parse(packageContent) as Record<string, unknown>;
      } catch (parseError) {
        this.logger.debug(
          `Failed to parse package.json: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`
        );
        return vulnerabilities;
      }

      const dependencies = packageJson.dependencies as Record<string, string> | undefined;
      const devDependencies = packageJson.devDependencies as Record<string, string> | undefined;
      const allDeps = {
        ...(dependencies && typeof dependencies === 'object' ? dependencies : {}),
        ...(devDependencies && typeof devDependencies === 'object' ? devDependencies : {}),
      };

      Object.entries(allDeps).forEach(([name, version]) => {
        if (typeof version === 'string' && version.includes('*')) {
          vulnerabilities.push({
            type: 'DEPENDENCY_VULN',
            file: 'package.json',
            line: 1,
            column: 0,
            message: `Dependency '${name}' has wildcard version - pin to specific version`,
            severity: 'MEDIUM',
          });
        }
      });
    } catch (error) {
      this.logger.debug(`Failed to scan dependencies: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return vulnerabilities;
  }

  private async findFiles(pattern: string, exclude: string[]): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectPath, fullPath);

          const pathSegments = relativePath.split(path.sep);
          if (pathSegments.some((segment) => exclude.includes(segment))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (this.matchPattern(relativePath, pattern)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EACCES') {
          this.logger.debug(`Permission denied reading directory: ${dir}`);
        }
      }
    };

    await walk(this.projectPath);
    return files;
  }

  private matchPattern(file: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`, 'i').test(file);
  }

  private async getStagedFiles(): Promise<string[]> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only']);
      return stdout
        .split('\n')
        .filter((f) => f.length > 0)
        .map((f) => path.join(this.projectPath, f));
    } catch (error) {
      this.logger.debug(`Failed to get staged files: ${error instanceof Error ? error.message : 'Unknown'}`);
      return [];
    }
  }

  private async scanFiles(files: string[]): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileVulns = this.checkJavaScriptPatterns(content, file);
        vulnerabilities.push(...fileVulns);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'EACCES') {
          this.logger.debug(`Permission denied reading file: ${file}`);
        } else if (err.code === 'ENOENT') {
          this.logger.debug(`File not found: ${file}`);
        } else {
          this.logger.debug(`Failed to read file ${file}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    }

    return vulnerabilities;
  }
}
