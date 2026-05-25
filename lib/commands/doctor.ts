import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';
import { c, rule, pad } from '../utils/palette.js';

const IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/target/**',
  '**/__pycache__/**',
];

function barFill(filled: number, total: number, width = 24): string {
  const f = Math.round((filled / Math.max(total, 1)) * width);
  return c.teal('▓'.repeat(f)) + c.faint('░'.repeat(width - f));
}

function scoreFill(score: number, width = 34): string {
  const f = Math.round((score / 100) * width);
  const col = score >= 80 ? c.green : score >= 55 ? c.amber : c.red;
  return col('▓'.repeat(f)) + c.faint('░'.repeat(width - f));
}

function scoreLabel(score: number): string {
  if (score >= 80) return c.green(`${score}`);
  if (score >= 55) return c.amber(`${score}`);
  return c.red(`${score}`);
}

interface HealthReport {
  name: string;
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
  const abs = path.resolve(projectPath);
  const name = path.basename(abs);

  // Header
  console.log('');
  console.log(c.faint('  ╭' + '─'.repeat(58) + '╮'));
  console.log(
    c.faint('  │') +
      c.teal('  SORK') +
      c.faint('  ·  ') +
      c.label('Project Health Report') +
      c.faint('  ·  ') +
      c.grey(name.slice(0, 22).padEnd(22)) +
      c.faint('  │')
  );
  console.log(c.faint('  ╰' + '─'.repeat(58) + '╯'));
  console.log('');

  const files = await fg('**/*', { cwd: abs, ignore: IGNORE, onlyFiles: true });
  const sourceExts = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.rs',
    '.go',
    '.java',
    '.rb',
    '.php',
    '.c',
    '.cpp',
    '.cs',
    '.mjs',
  ]);

  const report: HealthReport = {
    name,
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
    if (!sourceExts.has(path.extname(file).toLowerCase())) continue;
    const lang = detectLanguage(file);
    report.languages[lang] = (report.languages[lang] ?? 0) + 1;
    report.totalFiles++;

    try {
      const source = await fs.readFile(path.join(abs, file), 'utf-8');
      const vulns = scanWithLanguagePatterns(source, lang);
      const stability = runStabilityChecks(source, lang, file);
      const all = [...vulns, ...stability];

      report.totalIssues += all.length;
      report.aiArtifacts += stability.filter(
        (i) => (i as { aiGenerated?: boolean }).aiGenerated
      ).length;
      report.tornCode += stability.filter(
        (i) => (i as { category?: string }).category === 'torn_code'
      ).length;
      report.nullCrashes += stability.filter(
        (i) => (i as { category?: string }).category === 'null_crash'
      ).length;
      report.secretsFound += vulns.filter(
        (i) => (i as { category?: string }).category === 'secrets'
      ).length;
      report.errorSwallow += stability.filter(
        (i) => (i as { category?: string }).category === 'error_swallow'
      ).length;

      const criticals = all.filter((i) => i.severity === 'CRITICAL').length;
      const highs = all.filter((i) => i.severity === 'HIGH').length;
      if (criticals > 0 || highs > 0) report.criticalFiles.push({ file, criticals, highs });
    } catch {
      /* skip */
    }
  }

  const deductions =
    report.secretsFound * 20 +
    report.tornCode * 10 +
    report.nullCrashes * 6 +
    report.errorSwallow * 4 +
    report.aiArtifacts * 3 +
    Math.min(report.totalIssues * 0.4, 25);
  report.score = Math.max(0, Math.min(100, Math.round(100 - deductions)));

  // Language Breakdown
  console.log('  ' + c.label('Language Breakdown'));
  console.log('  ' + rule());
  const sorted = Object.entries(report.languages).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 1;
  for (const [lang, count] of sorted) {
    console.log(
      '  ' +
        c.white(pad(lang, 16)) +
        '  ' +
        barFill(count, maxCount, 22) +
        '  ' +
        c.dim(String(count).padStart(3)) +
        c.faint(' files')
    );
  }

  // Health Score
  console.log('');
  console.log('  ' + c.label('Health Score'));
  console.log('  ' + rule());
  console.log(
    '  ' +
      scoreFill(report.score) +
      '  ' +
      scoreLabel(report.score) +
      c.dim(' / 100') +
      '  ' +
      c.faint(`${report.totalIssues} issues · ${report.totalFiles} files`)
  );

  // Findings
  console.log('');
  console.log('  ' + c.label('Findings'));
  console.log('  ' + rule());

  const findings = [
    {
      key: 'secrets',
      count: report.secretsFound,
      color: c.red,
      note: 'rotate credentials immediately',
    },
    {
      key: 'torn code',
      count: report.tornCode,
      color: c.amber,
      note: 'unimplemented stubs will crash in production',
    },
    {
      key: 'ai artifacts',
      count: report.aiArtifacts,
      color: c.purple,
      note: 'verify generated logic is production-ready',
    },
    {
      key: 'null crashes',
      count: report.nullCrashes,
      color: c.yellow,
      note: 'missing null guards on chained calls',
    },
    {
      key: 'error swallow',
      count: report.errorSwallow,
      color: c.amber,
      note: 'empty catch blocks hiding failures',
    },
  ];

  for (const f of findings) {
    const countStr = f.count > 0 ? f.color(String(f.count).padStart(3)) : c.faint('  0');
    const noteStr = f.count > 0 ? f.color(f.note) : c.faint('none found');
    console.log('  ' + c.dim(pad(f.key, 18)) + countStr + '    ' + noteStr);
  }

  // High-Risk Files
  const risky = report.criticalFiles.sort((a, b) => b.criticals - a.criticals).slice(0, 8);
  if (risky.length > 0) {
    console.log('');
    console.log('  ' + c.label('High-Risk Files'));
    console.log('  ' + rule());
    for (const f of risky) {
      const tag = f.criticals > 0 ? c.red(pad('critical', 10)) : c.amber(pad('high', 10));
      const counts =
        f.criticals > 0
          ? c.red(`${f.criticals} critical${f.highs > 0 ? `, ${f.highs} high` : ''}`)
          : c.amber(`${f.highs} high`);
      const short = f.file.length > 38 ? '…' + f.file.slice(-37) : f.file;
      console.log('  ' + tag + '  ' + c.white(pad(short, 38)) + '  ' + counts);
    }
  }

  // Recommendations
  console.log('');
  console.log('  ' + c.label('Recommendations'));
  console.log('  ' + rule());

  let hasRec = false;
  if (report.secretsFound > 0) {
    console.log(
      '  ' +
        c.red(pad('urgent', 10)) +
        '  ' +
        c.red(
          `${report.secretsFound} credential(s) found — rotate and move to environment variables`
        )
    );
    hasRec = true;
  }
  if (report.tornCode > 0) {
    console.log(
      '  ' +
        c.amber(pad('fix', 10)) +
        '  ' +
        c.amber(`${report.tornCode} unimplemented function(s) — audit before any production deploy`)
    );
    hasRec = true;
  }
  if (report.aiArtifacts > 0) {
    console.log(
      '  ' +
        c.purple(pad('review', 10)) +
        '  ' +
        c.purple(
          `${report.aiArtifacts} AI-generated pattern(s) — manually verify each one is correct`
        )
    );
    hasRec = true;
  }
  if (report.errorSwallow > 0) {
    console.log(
      '  ' +
        c.amber(pad('fix', 10)) +
        '  ' +
        c.amber(`${report.errorSwallow} empty catch block(s) — add logging at minimum`)
    );
    hasRec = true;
  }
  if (!hasRec) {
    console.log(
      '  ' +
        c.green(pad('clean', 10)) +
        '  ' +
        c.green('No critical recommendations — project is in good health')
    );
  }

  // Footer
  console.log('');
  console.log(
    '  ' + c.faint('sork scan --file <path>') + c.faint('  ·  deep scan a specific file')
  );
  console.log(
    '  ' + c.faint('sork guard') + c.faint('               ·  watch for issues in real time')
  );
  console.log(
    '  ' + c.faint('sork review --staged') + c.faint('     ·  review staged files before commit')
  );
  console.log('');
}
