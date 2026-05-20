/**
 * sork guard — real-time file watcher
 */

import { watch } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import fg from 'fast-glob';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';

const WATCHABLE_EXTS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.py','.rs','.go','.java','.rb','.php','.c','.cpp','.h','.cs']);
const IGNORE_DIRS = new Set(['node_modules','.git','dist','build','.next','target','__pycache__']);

function shouldWatch(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!WATCHABLE_EXTS.has(ext)) return false;
  return !filePath.split(path.sep).some(p => IGNORE_DIRS.has(p));
}

function sev(s: string): string {
  if (s === 'CRITICAL') return chalk.bgRed.white(` ${s} `);
  if (s === 'HIGH') return chalk.red(s);
  if (s === 'MEDIUM') return chalk.yellow(s);
  return chalk.dim(s);
}

async function scanFile(filePath: string): Promise<void> {
  try {
    const source = await fs.readFile(filePath, 'utf-8');
    const lang = detectLanguage(filePath);
    const rel = path.relative(process.cwd(), filePath);
    const vulns = scanWithLanguagePatterns(source, lang);
    const stability = runStabilityChecks(source, lang, filePath);
    const all = [...vulns, ...stability];

    if (all.length === 0) { process.stdout.write(chalk.green(`  ✓ ${rel}\n`)); return; }

    const critical = all.filter(i => i.severity === 'CRITICAL');
    const high = all.filter(i => i.severity === 'HIGH');
    const med = all.filter(i => i.severity === 'MEDIUM');
    const low = all.filter(i => i.severity === 'LOW');

    console.log(`\n  📂 ${chalk.bold(rel)} ${chalk.dim(`[${lang}]`)}`);
    if (critical.length) console.log(chalk.bgRed.white(`  ${critical.length} CRITICAL`));
    if (high.length) console.log(chalk.red(`  ${high.length} HIGH`));
    if (med.length) console.log(chalk.yellow(`  ${med.length} MEDIUM`));
    if (low.length) console.log(chalk.dim(`  ${low.length} LOW`));

    for (const issue of [...critical, ...high].slice(0, 3)) {
      const id = 'patternId' in issue ? (issue as { patternId: string }).patternId : (issue as { id: string }).id;
      const name = 'name' in issue ? (issue as { name: string }).name : issue.category;
      console.log(`\n  ${sev(issue.severity)} ${chalk.bold(name)} ${chalk.dim(`[${id}]`)}`);
      console.log(`  ${chalk.dim(`Line ${issue.line}:`)} ${issue.snippet}`);
      console.log(`  ${chalk.dim('→')} ${'plain' in issue ? (issue as { plain: string }).plain : (issue as { message: string }).message}`);
      console.log(`  ${chalk.cyan('Fix:')} ${issue.fixHint}`);
    }
    if (all.length > 3) console.log(chalk.dim(`\n  ... and ${all.length - 3} more. Run: sork scan --file ${rel}`));
    console.log('');
  } catch { /* skip */ }
}

export async function guardProject(projectPath: string): Promise<void> {
  const absPath = path.resolve(projectPath);
  console.log(chalk.cyan('\n  SORK Guard — watching for changes'));
  console.log(chalk.dim(`  Project: ${absPath}`));
  console.log(chalk.dim('  Press Ctrl+C to stop\n'));
  console.log(chalk.bold('  Initial scan...'));

  const files = await fg('**/*', {
    cwd: absPath,
    ignore: [...IGNORE_DIRS].map(d => `**/${d}/**`),
    onlyFiles: true,
  });

  const sourceFiles = files.filter((f: string) => shouldWatch(f));
  console.log(chalk.dim(`  Found ${sourceFiles.length} source files\n`));

  for (const f of sourceFiles.slice(0, 20)) {
    await scanFile(path.join(absPath, f));
  }
  if (sourceFiles.length > 20) console.log(chalk.dim(`  (showing first 20 — run sork scan for full report)`));

  console.log(chalk.bold('\n  👁  Watching for changes...\n'));

  const watcher = watch(absPath, { recursive: true }, async (_event, filename) => {
    if (!filename) return;
    const full = path.join(absPath, filename);
    if (!shouldWatch(full)) return;
    console.log(chalk.dim(`  changed: ${path.relative(absPath, full)}`));
    await new Promise(r => setTimeout(r, 150));
    await scanFile(full);
  });

  process.on('SIGINT', () => { watcher.close(); console.log(chalk.dim('\n  Guard stopped.\n')); process.exit(0); });
}
