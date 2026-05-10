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
  private dryRun: boolean;

  constructor(projectPath: string, logger: Logger, dryRun = false) {
    this.projectPath = projectPath;
    this.logger = logger;
    this.dryRun = dryRun;
  }

  private validateFilePath(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    const absoluteProjectPath = path.resolve(this.projectPath);
    if (
      !absolutePath.startsWith(absoluteProjectPath + path.sep) &&
      absolutePath !== absoluteProjectPath
    ) {
      throw new Error(`Path traversal blocked: ${filePath}`);
    }
  }

  /**
   * Apply a single fix. Prefers range-based replacement (precise) over line-based (lossy).
   */
  async applyFix(fix: CodeFix, range?: [number, number]): Promise<void> {
    const filePath = path.join(this.projectPath, fix.file);
    this.validateFilePath(filePath);

    const content = await fs.readFile(filePath, 'utf-8');
    const updated = range
      ? this.replaceByRange(content, range, fix.newCode)
      : this.replaceByOldCode(content, fix);

    if (updated === content) {
      this.logger.warn(`No-op fix for ${fix.file}:${fix.line} (oldCode not found, skipping)`);
      return;
    }

    if (this.dryRun) {
      this.logger.info(`[dry-run] Would update ${fix.file}:${fix.line} - ${fix.description}`);
      return;
    }

    await fs.writeFile(filePath, updated, 'utf-8');
    this.logger.success(`Applied fix: ${fix.type} in ${fix.file}:${fix.line}`);
  }

  /**
   * Apply multiple fixes to multiple files. Within a file, applies highest-offset first
   * so earlier offsets remain valid.
   */
  async applyMultipleFixes(
    fixes: Array<{ fix: CodeFix; range?: [number, number] }>
  ): Promise<void> {
    const byFile = new Map<string, Array<{ fix: CodeFix; range?: [number, number] }>>();
    for (const entry of fixes) {
      const list = byFile.get(entry.fix.file) ?? [];
      list.push(entry);
      byFile.set(entry.fix.file, list);
    }

    for (const [file, entries] of byFile) {
      const filePath = path.join(this.projectPath, file);
      this.validateFilePath(filePath);

      let content = await fs.readFile(filePath, 'utf-8');
      entries.sort((a, b) => (b.range?.[0] ?? 0) - (a.range?.[0] ?? 0));

      let applied = 0;
      for (const { fix, range } of entries) {
        const next = range
          ? this.replaceByRange(content, range, fix.newCode)
          : this.replaceByOldCode(content, fix);
        if (next !== content) {
          content = next;
          applied++;
        }
      }

      if (this.dryRun) {
        this.logger.info(`[dry-run] Would apply ${applied}/${entries.length} fix(es) in ${file}`);
        continue;
      }
      await fs.writeFile(filePath, content, 'utf-8');
      this.logger.success(`Applied ${applied}/${entries.length} fix(es) in ${file}`);
    }
  }

  private replaceByRange(content: string, range: [number, number], newCode: string): string {
    const [start, end] = range;
    if (start < 0 || end > content.length || start >= end) {
      return content;
    }
    return content.slice(0, start) + newCode + content.slice(end);
  }

  /**
   * Fallback: locate exact oldCode in file and replace.
   * Less precise than range-based but works when range is unavailable.
   */
  private replaceByOldCode(content: string, fix: CodeFix): string {
    if (!fix.oldCode) {
      return content;
    }
    const idx = content.indexOf(fix.oldCode);
    if (idx === -1) {
      return content;
    }
    return content.slice(0, idx) + fix.newCode + content.slice(idx + fix.oldCode.length);
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
      this.logger.debug(`Prettier: ${filePath}`);
    } catch (err) {
      this.logger.debug(
        `Prettier failed for ${filePath}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  async lintAndFix(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      this.validateFilePath(fullPath);
      await this.formatWithPrettier(filePath);

      const eslintBin = path.join(this.projectPath, 'node_modules', '.bin', 'eslint');
      try {
        await execFileAsync(eslintBin, ['--fix', fullPath]);
        this.logger.debug(`ESLint --fix: ${filePath}`);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code !== 'ENOENT') {
          this.logger.debug(`ESLint: ${e.message}`);
        }
      }
    } catch (err) {
      this.logger.debug(`lintAndFix failed: ${err instanceof Error ? err.message : err}`);
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
