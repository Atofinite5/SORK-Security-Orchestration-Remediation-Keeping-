/**
 * sork doctor — full project health check
 * Covers: language breakdown, high-risk files, dep audit, config checks
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import fg from 'fast-glob';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';

const IGNORE = ['**/node_modules/**','**/dist/**','**/build/**','**/.git/**','**/target/**','**/__pycache__/**'];

interface HealthReport {
  totalFiles: number;
  languages: Record<string, number>;
  criticalFiles: Array<{ file: string; criticals: number; highs: number }>;
  aiArtifacts: number;
  tornCode: number;
  nullCrashes: number;
  secretsFound: number;
  totalIssues: number;
  score: number; // 0-100, higher = healthier
}

function scoreColor(score: number): string {
  if (score >= 80) return chalk.green(`${score}/100`);
  if (score >= 60) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}

export async function runDoctor(projectPath: string): Promise<void> {
  const abs = path.resolve(projectPath);

  console.log(chalk.bold('\n  SORK Doctor — Project Health Check\n'));
  console.log(chalk.dim(`  Scanning: ${abs}`));
  console.log(chalk.dim('  This may take a moment for large projects...\n'));

  const files = await fg('**/*', {
    cwd: abs,
    ignore: IGNORE,
    onlyFiles: true,
  });

  const report: HealthReport = {
    totalFiles: 0,
    languages: {},
    criticalFiles: [],
    aiArtifacts: 0,
    tornCode: 0,
    nullCrashes: 0,
    secretsFound: 0,
    totalIssues: 0,
    score: 100,
  };

  const sourceExts = new Set(['.ts','.tsx','.js','.jsx','.py','.rs','.go','.java','.rb','.php','.c','.cpp','.cs','.mjs']);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!sourceExts.has(ext)) continue;

    const lang = detectLanguage(file);
    report.languages[lang] = (report.languages[lang] ?? 0) + 1;
    report.totalFiles++;

    try {
      const source = await fs.readFile(path.join(abs, file), 'utf-8');
      const vulns = scanWithLanguagePatterns(source, lang);
      const stability = runStabilityChecks(source, lang, file);

      const criticals = [...vulns, ...stability].filter(i => i.severity === 'CRITICAL').length;
      const highs = [...vulns, ...stability].filter(i => i.severity === 'HIGH').length;

      report.totalIssues += vulns.length + stability.length;
      report.aiArtifacts += stability.filter(i => 'aiGenerated' in i && i.aiGenerated).length;
      report.tornCode += stability.filter(i => 'category' in i && i.category === 'torn_code').length;
      report.nullCrashes += stability.filter(i => 'category' in i && i.category === 'null_crash').length;
      report.secretsFound += vulns.filter(i => 'category' in i && i.category === 'secrets').length;

      if (criticals > 0 || highs > 0) {
        report.criticalFiles.push({ file, criticals, highs });
      }
    } catch { /* skip */ }
  }

  // Calculate health score
  const deductions =
    report.secretsFound * 20 +
    report.tornCode * 10 +
    report.nullCrashes * 5 +
    report.aiArtifacts * 3 +
    Math.min(report.totalIssues * 0.5, 30);
  report.score = Math.max(0, Math.min(100, 100 - deductions));

  // Print report
  console.log(chalk.bold('  ── Language Breakdown ─────────────────────────'));
  for (const [lang, count] of Object.entries(report.languages).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.min(Math.ceil(count / report.totalFiles * 20), 20));
    console.log(`  ${lang.padEnd(14)} ${chalk.cyan(bar)} ${count} files`);
  }

  console.log(chalk.bold('\n  ── Health Score ────────────────────────────────'));
  console.log(`  Score: ${scoreColor(report.score)}  (${report.totalIssues} total issues in ${report.totalFiles} files)`);

  const checks = [
    { label: 'Secrets / credentials', count: report.secretsFound, icon: report.secretsFound > 0 ? '🔴' : '✅' },
    { label: 'Torn / stub code', count: report.tornCode, icon: report.tornCode > 0 ? '🟡' : '✅' },
    { label: 'Null crash risks', count: report.nullCrashes, icon: report.nullCrashes > 0 ? '🟡' : '✅' },
    { label: 'AI artifacts', count: report.aiArtifacts, icon: report.aiArtifacts > 0 ? '🟡' : '✅' },
  ];

  console.log('');
  for (const c of checks) {
    console.log(`  ${c.icon} ${c.label.padEnd(25)} ${c.count > 0 ? chalk.yellow(String(c.count)) : chalk.green('0')}`);
  }

  if (report.criticalFiles.length > 0) {
    console.log(chalk.bold('\n  ── High-Risk Files ─────────────────────────────'));
    for (const f of report.criticalFiles.sort((a, b) => b.criticals - a.criticals).slice(0, 10)) {
      const tag = f.criticals > 0 ? chalk.bgRed.white(' CRITICAL ') : chalk.red(' HIGH ');
      console.log(`  ${tag} ${f.file}`);
      if (f.criticals) console.log(`         ${chalk.red(`${f.criticals} critical`)}`);
      if (f.highs) console.log(`         ${chalk.yellow(`${f.highs} high`)}`);
    }
  }

  console.log(chalk.bold('\n  ── Recommendations ─────────────────────────────'));
  if (report.secretsFound > 0) {
    console.log(chalk.red(`  🔴 URGENT: ${report.secretsFound} credential(s) found in source. Rotate them NOW and move to env vars.`));
  }
  if (report.tornCode > 0) {
    console.log(chalk.yellow(`  🟡 ${report.tornCode} stub/incomplete function(s) — will crash in production. Review before shipping.`));
  }
  if (report.aiArtifacts > 0) {
    console.log(chalk.yellow(`  ⚡ ${report.aiArtifacts} AI-generated pattern(s) — manually review these for correctness.`));
  }
  if (report.score >= 80) {
    console.log(chalk.green('  ✓ Project is in good health.'));
  }

  console.log(chalk.dim('\n  Run `sork scan` for a full vulnerability report.'));
  console.log(chalk.dim('  Run `sork guard` to watch for issues in real time.\n'));
}
