import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';
import { c, sevBadge, rule } from '../utils/palette.js';

const exec = promisify(execFile);

export interface ReviewResult {
  file: string;
  language: string;
  vulnCount: number;
  stabilityCount: number;
  aiArtifacts: number;
  topIssues: Array<{ severity: string; message: string; line: number; fixHint: string; plain: string }>;
  verdict: 'APPROVE' | 'WARN' | 'BLOCK';
  summary: string;
}

async function getGitDiff(): Promise<string> {
  try {
    const { stdout } = await exec('git', ['diff', '--staged', '--name-only']);
    return stdout;
  } catch {
    return '';
  }
}

export async function reviewFile(filePath: string): Promise<ReviewResult> {
  const abs  = path.resolve(filePath);
  const src  = await fs.readFile(abs, 'utf-8');
  const lang = detectLanguage(abs);
  const rel  = path.relative(process.cwd(), abs);

  const vulns     = scanWithLanguagePatterns(src, lang);
  const stability = runStabilityChecks(src, lang, rel);
  const all       = [...vulns, ...stability];

  const criticals   = all.filter(i => i.severity === 'CRITICAL').length;
  const highs       = all.filter(i => i.severity === 'HIGH').length;
  const aiArtifacts = stability.filter(i => (i as {aiGenerated?:boolean}).aiGenerated).length;

  const topIssues = all
    .filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')
    .slice(0, 5)
    .map(i => ({
      severity : i.severity,
      message  : 'name'  in i ? (i as {name:string}).name    : i.category,
      line     : i.line,
      fixHint  : i.fixHint,
      plain    : 'plain' in i ? (i as {plain:string}).plain  : (i as {message:string}).message,
    }));

  const verdict: 'APPROVE' | 'WARN' | 'BLOCK' =
    criticals > 0          ? 'BLOCK'   :
    highs > 0 || aiArtifacts > 0 ? 'WARN' : 'APPROVE';

  const summary =
    verdict === 'APPROVE' ? `no critical issues  ·  ${rel}` :
    verdict === 'WARN'    ? `${highs} high${aiArtifacts > 0 ? `, ${aiArtifacts} ai artifacts` : ''}  ·  review before merging` :
                            `${criticals} critical  ·  do not merge without fixing`;

  return { file: rel, language: lang, vulnCount: vulns.length, stabilityCount: stability.length, aiArtifacts, topIssues, verdict, summary };
}

function verdictLine(r: ReviewResult): void {
  const [col, tag] =
    r.verdict === 'BLOCK'   ? [c.red,   'block  '] :
    r.verdict === 'WARN'    ? [c.amber, 'warn   '] :
                              [c.green, 'approve'];

  console.log(
    '  ' + col(tag) +
    '  ' + c.white(r.file) +
    c.faint(`  [${r.language}]`)
  );
  console.log('  ' + c.faint(' '.repeat(9)) + c.dim(r.summary));
}

export async function reviewStagedFiles(): Promise<void> {
  const diff  = await getGitDiff();
  const files = diff.trim().split('\n').filter(Boolean);

  if (files.length === 0) {
    console.log('');
    console.log('  ' + c.dim('no staged files'));
    console.log('');
    return;
  }

  console.log('');
  console.log(c.faint('  ╭' + '─'.repeat(58) + '╮'));
  console.log(c.faint('  │') + c.teal('  SORK Review') + c.faint(`  ·  ${files.length} staged file(s)`) + c.faint(' '.repeat(Math.max(0, 34 - String(files.length).length)) + '│'));
  console.log(c.faint('  ╰' + '─'.repeat(58) + '╯'));
  console.log('');

  let blocks = 0, warns = 0;

  for (const file of files) {
    try {
      const result = await reviewFile(file);
      verdictLine(result);

      for (const issue of result.topIssues) {
        console.log('');
        console.log('  ' + c.faint(' '.repeat(9)) + sevBadge(issue.severity) + c.faint(`  line ${issue.line}`) + '  ' + c.white(issue.message));
        console.log('  ' + c.faint(' '.repeat(9)) + c.faint('→  ') + c.label(issue.plain));
        console.log('  ' + c.faint(' '.repeat(9)) + c.teal('fix  ') + c.dim(issue.fixHint));
      }

      if (result.aiArtifacts > 0) {
        console.log('  ' + c.faint(' '.repeat(9)) + c.purple(`${result.aiArtifacts} ai-generated pattern(s)  ·  verify before merging`));
      }

      console.log('');
      if (result.verdict === 'BLOCK') blocks++;
      if (result.verdict === 'WARN')  warns++;
    } catch {
      console.log('  ' + c.dim(`could not review: ${file}`));
    }
  }

  console.log('  ' + rule());

  if (blocks > 0) {
    console.log('  ' + c.red(`blocked  ·  ${blocks} file(s) with critical issues`));
    console.log('  ' + c.dim('fix all critical issues before committing'));
    process.exitCode = 1;
  } else if (warns > 0) {
    console.log('  ' + c.amber(`warning  ·  ${warns} file(s) with high issues or ai artifacts`));
    console.log('  ' + c.dim('review carefully before merging'));
  } else {
    console.log('  ' + c.green('all staged files passed review'));
  }
  console.log('');
}

export async function reviewDiff(diffText: string): Promise<void> {
  const lines = diffText.split('\n');
  let currentFile = '';
  let lineNum = 0;
  const findings: Array<{ file: string; line: number; severity: string; message: string; fixHint: string }> = [];

  for (const line of lines) {
    if (line.startsWith('+++ b/')) { currentFile = line.slice(6); continue; }
    if (line.startsWith('@@')) {
      const m = line.match(/@@ \+(\d+)/);
      lineNum = m ? parseInt(m[1]!) - 1 : 0;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      const added     = line.slice(1);
      const lang      = detectLanguage(currentFile);
      const matches   = scanWithLanguagePatterns(added, lang);
      const stability = runStabilityChecks(added, lang, currentFile);
      for (const m of [...matches, ...stability]) {
        findings.push({
          file     : currentFile,
          line     : lineNum,
          severity : m.severity,
          message  : 'name' in m ? (m as {name:string}).name : m.category,
          fixHint  : m.fixHint,
        });
      }
    } else if (!line.startsWith('-')) {
      lineNum++;
    }
  }

  if (findings.length === 0) {
    console.log('');
    console.log('  ' + c.green('no issues found in diff'));
    console.log('');
    return;
  }

  console.log('');
  console.log('  ' + c.label(`diff review  ·  ${findings.length} issue(s) found`));
  console.log('  ' + rule());
  for (const f of findings.slice(0, 10)) {
    console.log('  ' + sevBadge(f.severity) + '  ' + c.faint(`${f.file}:${f.line}`) + '  ' + c.white(f.message));
    console.log('  ' + c.teal('fix  ') + c.dim(f.fixHint));
    console.log('');
  }
}
