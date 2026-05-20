/**
 * sork doctor — full project health check
 * Pastel color palette, no emojis, clean typographic layout.
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import fg from 'fast-glob';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';

const IGNORE = ['**/node_modules/**','**/dist/**','**/build/**','**/.git/**','**/target/**','**/__pycache__/**'];

// ── Pastel palette ────────────────────────────────────────────────────────
const P = {
  red:    (s: string) => chalk.hex('#ffb3b3')(s),
  amber:  (s: string) => chalk.hex('#ffd9a0')(s),
  green:  (s: string) => chalk.hex('#a8e6a3')(s),
  blue:   (s: string) => chalk.hex('#a0c4ff')(s),
  purple: (s: string) => chalk.hex('#d4c0ff')(s),
  cyan:   (s: string) => chalk.hex('#a0e8f0')(s),
  grey:   (s: string) => chalk.hex('#8a9ba8')(s),
  white:  (s: string) => chalk.hex('#e8eaed')(s),
  dim:    (s: string) => chalk.hex('#5a6472')(s),
  label:  (s: string) => chalk.hex('#c8cdd4')(s),
};

// ── Helpers ───────────────────────────────────────────────────────────────
function bar(filled: number, total: number, width = 24): string {
  const f = Math.round((filled / Math.max(total, 1)) * width);
  const e = width - f;
  return P.cyan('▓'.repeat(f)) + P.dim('░'.repeat(e));
}

function scoreBar(score: number, width = 32): string {
  const f = Math.round((score / 100) * width);
  const e = width - f;
  const color = score >= 80 ? P.green : score >= 55 ? P.amber : P.red;
  return color('▓'.repeat(f)) + P.dim('░'.repeat(e));
}

function scoreLabel(score: number): string {
  if (score >= 80) return P.green(`${score}`);
  if (score >= 55) return P.amber(`${score}`);
  return P.red(`${score}`);
}

function rule(width = 58): string {
  return P.dim('─'.repeat(width));
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

interface HealthReport {
  projectName: string;
  totalFiles: number;
  languages: Record<string, number>;
  criticalFiles: Array<{ file: string; criticals: number; highs: number }>;
  aiArtifacts: number;
  tornCode: number;
  nullCrashes: number;
  secretsFound: number;
  errorSwallow: number;
  totalIssues: number;
  score: number;
}

export async function runDoctor(projectPath: string): Promise<void> {
  const abs  = path.resolve(projectPath);
  const name = path.basename(abs);

  // ── Header ──────────────────────────────────────────────────────────────
  console.log('');
  console.log(P.dim('  ╭' + '─'.repeat(58) + '╮'));
  console.log(P.dim('  │') + P.cyan('  SORK') + P.dim('  ·  ') + P.label('Project Health Report') + P.dim('  ·  ') + P.grey(name.slice(0,24).padEnd(24)) + P.dim('  │'));
  console.log(P.dim('  ╰' + '─'.repeat(58) + '╯'));
  console.log('');

  const files = await fg('**/*', { cwd: abs, ignore: IGNORE, onlyFiles: true });
  const sourceExts = new Set(['.ts','.tsx','.js','.jsx','.py','.rs','.go','.java','.rb','.php','.c','.cpp','.cs','.mjs']);

  const report: HealthReport = {
    projectName: name,
    totalFiles: 0,
    languages: {},
    criticalFiles: [],
    aiArtifacts: 0,
    tornCode: 0,
    nullCrashes: 0,
    secretsFound: 0,
    errorSwallow: 0,
    totalIssues: 0,
    score: 100,
  };

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!sourceExts.has(ext)) continue;

    const lang = detectLanguage(file);
    report.languages[lang] = (report.languages[lang] ?? 0) + 1;
    report.totalFiles++;

    try {
      const source = await fs.readFile(path.join(abs, file), 'utf-8');
      const vulns     = scanWithLanguagePatterns(source, lang);
      const stability = runStabilityChecks(source, lang, file);

      const criticals = [...vulns,...stability].filter(i => i.severity === 'CRITICAL').length;
      const highs     = [...vulns,...stability].filter(i => i.severity === 'HIGH').length;

      report.totalIssues  += vulns.length + stability.length;
      report.aiArtifacts  += stability.filter(i => 'aiGenerated' in i && (i as {aiGenerated:boolean}).aiGenerated).length;
      report.tornCode     += stability.filter(i => 'category' in i && (i as {category:string}).category === 'torn_code').length;
      report.nullCrashes  += stability.filter(i => 'category' in i && (i as {category:string}).category === 'null_crash').length;
      report.secretsFound += vulns.filter(i => 'category' in i && (i as {category:string}).category === 'secrets').length;
      report.errorSwallow += stability.filter(i => 'category' in i && (i as {category:string}).category === 'error_swallow').length;

      if (criticals > 0 || highs > 0) {
        report.criticalFiles.push({ file, criticals, highs });
      }
    } catch { /* skip unreadable */ }
  }

  // Score
  const deductions =
    report.secretsFound * 20 +
    report.tornCode     * 10 +
    report.nullCrashes  * 6  +
    report.errorSwallow * 4  +
    report.aiArtifacts  * 3  +
    Math.min(report.totalIssues * 0.4, 25);
  report.score = Math.max(0, Math.min(100, Math.round(100 - deductions)));

  // ── Language Breakdown ──────────────────────────────────────────────────
  console.log('  ' + P.label('Language Breakdown'));
  console.log('  ' + rule());

  const sorted = Object.entries(report.languages).sort((a,b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 1;

  for (const [lang, count] of sorted) {
    const b = bar(count, maxCount, 22);
    console.log(
      '  ' +
      P.white(pad(lang, 16)) +
      '  ' + b +
      '  ' + P.dim(String(count).padStart(3)) +
      P.dim(' files')
    );
  }

  // ── Health Score ─────────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + P.label('Health Score'));
  console.log('  ' + rule());
  console.log(
    '  ' +
    scoreBar(report.score, 32) +
    '  ' +
    scoreLabel(report.score) +
    P.dim(' / 100') +
    '  ' +
    P.dim(`${report.totalIssues} issues · ${report.totalFiles} files`)
  );

  // ── Findings ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + P.label('Findings'));
  console.log('  ' + rule());

  const findings = [
    {
      key: 'secrets',
      count: report.secretsFound,
      color: report.secretsFound > 0 ? P.red : P.green,
      note: report.secretsFound > 0 ? 'rotate credentials immediately' : 'none found',
    },
    {
      key: 'torn code',
      count: report.tornCode,
      color: report.tornCode > 0 ? P.amber : P.green,
      note: report.tornCode > 0 ? 'unimplemented stubs will crash in production' : 'none found',
    },
    {
      key: 'ai artifacts',
      count: report.aiArtifacts,
      color: report.aiArtifacts > 0 ? P.purple : P.green,
      note: report.aiArtifacts > 0 ? 'verify generated logic is production-ready' : 'none found',
    },
    {
      key: 'null crashes',
      count: report.nullCrashes,
      color: report.nullCrashes > 0 ? P.amber : P.green,
      note: report.nullCrashes > 0 ? 'missing null guards on chained calls' : 'none found',
    },
    {
      key: 'error swallow',
      count: report.errorSwallow,
      color: report.errorSwallow > 0 ? P.amber : P.green,
      note: report.errorSwallow > 0 ? 'empty catch blocks hiding failures' : 'none found',
    },
  ];

  for (const f of findings) {
    const countStr = f.count > 0 ? f.color(String(f.count).padStart(3)) : P.dim('  0');
    console.log(
      '  ' +
      P.dim(pad(f.key, 18)) +
      countStr +
      '    ' +
      (f.count > 0 ? f.color(f.note) : P.dim(f.note))
    );
  }

  // ── High-Risk Files ───────────────────────────────────────────────────────
  const risky = report.criticalFiles.sort((a,b) => b.criticals - a.criticals).slice(0, 8);
  if (risky.length > 0) {
    console.log('');
    console.log('  ' + P.label('High-Risk Files'));
    console.log('  ' + rule());

    for (const f of risky) {
      const tag = f.criticals > 0
        ? P.red(pad('critical', 10))
        : P.amber(pad('high', 10));
      const counts = f.criticals > 0
        ? P.red(`${f.criticals} critical${f.highs > 0 ? `, ${f.highs} high` : ''}`)
        : P.amber(`${f.highs} high`);
      const shortFile = f.file.length > 38 ? '…' + f.file.slice(-37) : f.file;
      console.log('  ' + tag + '  ' + P.white(pad(shortFile, 38)) + '  ' + counts);
    }
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + P.label('Recommendations'));
  console.log('  ' + rule());

  if (report.secretsFound > 0) {
    console.log('  ' + P.red(pad('urgent', 10)) + '  ' + P.red(`${report.secretsFound} credential(s) in source — rotate and move to environment variables`));
  }
  if (report.tornCode > 0) {
    console.log('  ' + P.amber(pad('fix', 10)) + '  ' + P.amber(`${report.tornCode} unimplemented function(s) — audit before any production deploy`));
  }
  if (report.aiArtifacts > 0) {
    console.log('  ' + P.purple(pad('review', 10)) + '  ' + P.purple(`${report.aiArtifacts} AI-generated pattern(s) — manually verify each one is correct`));
  }
  if (report.errorSwallow > 0) {
    console.log('  ' + P.amber(pad('fix', 10)) + '  ' + P.amber(`${report.errorSwallow} empty catch block(s) — add logging at minimum`));
  }
  if (report.score >= 80 && report.secretsFound === 0) {
    console.log('  ' + P.green(pad('good', 10)) + '  ' + P.green('Project is in good health.'));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + P.dim('sork scan --file <path>') + P.dim('  ·  full scan a specific file'));
  console.log('  ' + P.dim('sork guard') + P.dim('               ·  watch for issues in real time'));
  console.log('  ' + P.dim('sork review --staged') + P.dim('     ·  review staged files before commit'));
  console.log('');
}
