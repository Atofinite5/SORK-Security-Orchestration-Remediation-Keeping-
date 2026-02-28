import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger.js';
import { CodeFix } from '../types/index.js';

const execFileAsync = promisify(execFile);

export class CodeFixer {
  private projectPath: string;
  private logger: Logger;

  constructor(projectPath: string, logger: Logger) {
    this.projectPath = projectPath;
    this.logger = logger;
  }

  private validateFilePath(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    const absoluteProjectPath = path.resolve(this.projectPath);

    if (
      !absolutePath.startsWith(absoluteProjectPath + path.sep) &&
      absolutePath !== absoluteProjectPath
    ) {
      throw new Error(`Path traversal attack detected: ${filePath}`);
    }
  }

  async applyFix(fix: CodeFix): Promise<void> {
    try {
      const filePath = path.join(this.projectPath, fix.file);
      this.validateFilePath(filePath);

      let content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      if (fix.line > 0 && fix.line <= lines.length) {
        const lineIndex = fix.line - 1;
        const newCodeLines = fix.newCode.split('\n');

        lines.splice(lineIndex, 1, ...newCodeLines);
        content = lines.join('\n');

        await fs.writeFile(filePath, content, 'utf-8');
        this.logger.success(
          `Applied fix: ${fix.type} in ${fix.file}:${fix.line} (${newCodeLines.length} line(s))`
        );
      } else {
        this.logger.warn(
          `Could not apply fix: line ${fix.line} is out of bounds for ${fix.file}`
        );
      }
    } catch (error) {
      throw new Error(`Failed to apply fix: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async applyMultipleFixes(fixes: CodeFix[]): Promise<Map<string, string>> {
    const fileChanges = new Map<string, string>();
    const fixesByFile = new Map<string, CodeFix[]>();

    for (const fix of fixes) {
      if (!fixesByFile.has(fix.file)) {
        fixesByFile.set(fix.file, []);
      }
      fixesByFile.get(fix.file)!.push(fix);
    }

    for (const [file, fileFixes] of fixesByFile) {
      try {
        const filePath = path.join(this.projectPath, file);
        this.validateFilePath(filePath);

        const content = await fs.readFile(filePath, 'utf-8');
        fileFixes.sort((a, b) => b.line - a.line);

        const lines = content.split('\n');

        for (const fix of fileFixes) {
          if (fix.line > 0 && fix.line <= lines.length) {
            const lineIndex = fix.line - 1;
            const newCodeLines = fix.newCode.split('\n');
            lines.splice(lineIndex, 1, ...newCodeLines);
          }
        }

        const newContent = lines.join('\n');
        await fs.writeFile(filePath, newContent, 'utf-8');
        fileChanges.set(file, newContent);

        this.logger.success(`Applied ${fileFixes.length} fixes in ${file}`);
      } catch (error) {
        this.logger.error(`Failed to apply fixes in ${file}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return fileChanges;
  }

  async formatWithPrettier(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      this.validateFilePath(fullPath);

      const content = await fs.readFile(fullPath, 'utf-8');
      const prettier = await import('prettier');

      const formatted = await prettier.format(content, {
        parser: this.getParser(filePath),
        singleQuote: true,
        trailingComma: 'es5',
        semi: true,
        tabWidth: 2,
      });

      await fs.writeFile(fullPath, formatted, 'utf-8');
      this.logger.success(`Formatted with Prettier: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to format ${filePath}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async lintAndFix(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      this.validateFilePath(fullPath);

      await this.formatWithPrettier(filePath);

      const eslintPath = path.join(this.projectPath, 'node_modules', '.bin', 'eslint');

      try {
        await execFileAsync(eslintPath, ['--fix', fullPath]);
        this.logger.success(`Linted and fixed: ${filePath}`);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          this.logger.debug(`ESLint error: ${error instanceof Error ? error.message : 'Unknown'}`);
        } else {
          this.logger.debug(`ESLint not available, skipping lint-fix for ${filePath}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to lint/fix ${filePath}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private getParser(filePath: string): string {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return 'typescript';
    }
    if (filePath.endsWith('.json')) {
      return 'json';
    }
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return 'yaml';
    }
    return 'babel';
  }
}
