import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';
import ignore, { Ignore } from 'ignore';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger.js';
import { Vulnerability } from '../types/index.js';
import { scanSource } from './astWalker.js';

const execFileAsync = promisify(execFile);

const SOURCE_GLOBS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];
const ALWAYS_IGNORE = [
  'node_modules/**',
  'dist/**',
  'build/**',
  '.git/**',
  'coverage/**',
  '.next/**',
  'out/**',
  '*.min.js',
];

// Performance: Cache for scan results
const scanCache = new Map<string, { vulns: Vulnerability[]; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds cache

export class SecurityScanner {
  private projectPath: string;
  private logger: Logger;
  private ig: Ignore | null = null;

  constructor(projectPath: string, logger: Logger) {
    this.projectPath = projectPath;
    this.logger = logger;
  }

  async scan(): Promise<Vulnerability[]> {
    this.logger.info('Scanning project for vulnerabilities...');
    const files = await this.collectFiles();
    this.logger.debug(`Scanning ${files.length} source file(s)`);

    // Performance: Parallel scanning with batches
    const codeVulns = await this.scanFilesParallel(files);
    const depVulns = await this.scanDependencies();

    return [...codeVulns, ...depVulns];
  }

  async scanStaged(): Promise<Vulnerability[]> {
    const stagedFiles = await this.getStagedFiles();
    if (stagedFiles.length === 0) {
      this.logger.debug('No staged files');
      return [];
    }
    return this.scanFilesParallel(stagedFiles);
  }

  /**
   * Re-scan a single file. Used by Keeper to verify fixes didn't introduce new vulns.
   */
  async scanFile(file: string): Promise<Vulnerability[]> {
    return this.scanFilesParallel([file]);
  }

  /**
   * Performance: Parallel file scanning with batches
   */
  private async scanFilesParallel(files: string[]): Promise<Vulnerability[]> {
    const out: Vulnerability[] = [];
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (file) => this.scanSingleFile(file))
      );
      for (const vulns of results) {
        out.push(...vulns);
      }
    }

    return out;
  }

  /**
   * Scan a single file with caching
   */
  private async scanSingleFile(file: string): Promise<Vulnerability[]> {
    try {
      const stat = await fs.stat(file);
      // Skip large files (>1MB)
      if (stat.size > 1_000_000) {
        this.logger.debug(`Skipping large file (${stat.size} bytes): ${file}`);
        return [];
      }

      const content = await fs.readFile(file, 'utf-8');
      const relative = path.relative(this.projectPath, file);

// Check cache
      const cacheKey = `${relative}:${stat.mtimeMs}`;
      const cached = scanCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.vulns;
      }

      const vulns = scanSource(content, relative);

      // Cache results
      scanCache.set(cacheKey, { vulns, timestamp: Date.now() });

      return vulns;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT' && e.code !== 'EACCES') {
        this.logger.debug(`Skipped ${file}: ${e.message}`);
      }
    }
    return [];
  }

  private async collectFiles(): Promise<string[]> {
    await this.loadIgnore();

    const matches = await fg(SOURCE_GLOBS, {
      cwd: this.projectPath,
      ignore: ALWAYS_IGNORE,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      dot: false,
    });

    if (!this.ig) {
      return matches;
    }
    const filtered = matches.filter((file) => {
      const rel = path.relative(this.projectPath, file);
      return !this.ig!.ignores(rel);
    });
    return filtered;
  }

  private async loadIgnore(): Promise<void> {
    if (this.ig) {
      return;
    }
    this.ig = ignore();
    try {
      const gitignorePath = path.join(this.projectPath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.ig.add(content);
    } catch {
      // No .gitignore - that's fine
    }
  }

  private async scanDependencies(): Promise<Vulnerability[]> {
    const out: Vulnerability[] = [];
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const raw = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;

      const deps = (pkg.dependencies ?? {}) as Record<string, string>;
      const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;

      for (const [name, version] of Object.entries({ ...deps, ...devDeps })) {
        if (typeof version !== 'string') {
          continue;
        }
        if (version.includes('*') || version === 'latest') {
          out.push({
            type: 'DEPENDENCY_VULN',
            file: 'package.json',
            line: 1,
            column: 0,
            message: `Dependency '${name}' has unpinned version '${version}' - pin to a specific version`,
            severity: 'MEDIUM',
          });
        }
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        this.logger.debug(`Failed to scan dependencies: ${e.message}`);
      }
    }
    return out;
  }

  private async getStagedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
        {
          cwd: this.projectPath,
        }
      );
      return stdout
        .split('\n')
        .filter((f) => f.length > 0 && SOURCE_GLOBS.some((g) => matchExt(f, g)))
        .map((f) => path.join(this.projectPath, f));
    } catch {
      this.logger.debug('git diff failed');
      return [];
    }
  }

  /**
   * Clear scan cache
   */
  static clearCache(): void {
    scanCache.clear();
  }
}

function matchExt(file: string, glob: string): boolean {
  const ext = glob.match(/\*\.(\w+)$/)?.[1];
  return ext ? file.endsWith(`.${ext}`) : false;
}
