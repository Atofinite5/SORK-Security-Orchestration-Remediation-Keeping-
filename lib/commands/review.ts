/**
 * sork review — validate AI-generated diffs before committing
 * Also works as a general "review this file" command.
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';


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
  const abs = path.resolve(filePath);
  const source = await fs.readFile(abs, 'utf-8');
  const lang = detectLanguage(abs);
  const rel = path.relative(process.cwd(), abs);

  const vulns = scanWithLanguagePatterns(source, lang);
  const stability = runStabilityChecks(source, lang, rel);

  const criticalOrHigh = [...vulns, ...stability].filter(i =>
    i.severity === 'CRITICAL' || i.severity === 'HIGH'
  );
  const aiArtifacts = stability.filter(i => 'aiGenerated' in i && i.aiGenerated).length;
  const topIssues = criticalOrHigh.slice(0, 5).map(i => ({
    severity: i.severity,
    message: 'message' in i ? i.message : (i as { name: string }).name,
    line: i.line,
    fixHint: i.fixHint,
    plain: 'plain' in i ? i.plain : i.message,
  }));

  const criticals = [...vulns, ...stability].filter(i => i.severity === 'CRITICAL').length;
  const highs = [...vulns, ...stability].filter(i => i.severity === 'HIGH').length;

  let verdict: 'APPROVE' | 'WARN' | 'BLOCK' = 'APPROVE';
  if (criticals > 0) verdict = 'BLOCK';
  else if (highs > 0 || aiArtifacts > 0) verdict = 'WARN';

  const summary = verdict === 'APPROVE'
    ? `No critical issues found in ${rel}.`
    : verdict === 'WARN'
    ? `${highs} HIGH issue(s)${aiArtifacts > 0 ? ` and ${aiArtifacts} AI artifact(s)` : ''} — review before merging.`
    : `${criticals} CRITICAL issue(s) found — DO NOT merge without fixing.`;

  return {
    file: rel,
    language: lang,
    vulnCount: vulns.length,
    stabilityCount: stability.length,
    aiArtifacts,
    topIssues,
    verdict,
    summary,
  };
}

export async function reviewStagedFiles(): Promise<void> {
  const diff = await getGitDiff();
  const files = diff.trim().split('\n').filter(Boolean);

  if (files.length === 0) {
    console.log(chalk.dim('  No staged files to review.'));
    return;
  }

  console.log(chalk.bold(`\n  SORK Review — ${files.length} staged file(s)\n`));

  let totalBlocks = 0;
  let totalWarns = 0;

  for (const file of files) {
    try {
      const result = await reviewFile(file);
      const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '✅';

      console.log(`  ${icon} ${chalk.bold(result.file)} ${chalk.dim(`[${result.language}]`)}`);
      console.log(`     ${result.summary}`);

      for (const issue of result.topIssues) {
        console.log(`\n     ${chalk.red(issue.severity)} Line ${issue.line}: ${issue.message}`);
        console.log(`     ${chalk.dim('→')} ${issue.plain}`);
        console.log(`     ${chalk.cyan('Fix:')} ${issue.fixHint}`);
      }

      if (result.aiArtifacts > 0) {
        console.log(`\n     ${chalk.yellow('⚡')} ${result.aiArtifacts} AI-generated code pattern(s) detected — verify these are production-ready`);
      }

      console.log('');

      if (result.verdict === 'BLOCK') totalBlocks++;
      if (result.verdict === 'WARN') totalWarns++;
    } catch {
      console.log(chalk.dim(`  ⚠ Could not review: ${file}`));
    }
  }

  console.log(chalk.dim('─'.repeat(60)));
  if (totalBlocks > 0) {
    console.log(chalk.bgRed.white(`  BLOCKED: ${totalBlocks} file(s) have CRITICAL issues`));
    console.log(chalk.red('  Fix all CRITICAL issues before committing.\n'));
    process.exitCode = 1;
  } else if (totalWarns > 0) {
    console.log(chalk.yellow(`  WARNING: ${totalWarns} file(s) have HIGH issues or AI artifacts`));
    console.log(chalk.dim('  Review carefully before merging.\n'));
  } else {
    console.log(chalk.green('  All staged files passed review ✓\n'));
  }
}

export async function reviewDiff(diffText: string): Promise<void> {
  // Parse unified diff to extract added lines
  const lines = diffText.split('\n');
  let currentFile = '';
  
  let lineNum = 0;

  const findings: Array<{ file: string; line: number; severity: string; message: string; fixHint: string }> = [];

  for (const line of lines) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      if (line.startsWith('+++ b/')) currentFile = line.slice(6);
      continue;
    }
    if (line.startsWith('@@')) {
      const m = line.match(/@@ \+(\d+)/);
      lineNum = m ? parseInt(m[1]!) - 1 : 0;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      const added = line.slice(1);
      const lang = detectLanguage(currentFile);
      const matches = scanWithLanguagePatterns(added, lang);
      const stability = runStabilityChecks(added, lang, currentFile);
      for (const m of [...matches, ...stability]) {
        findings.push({
          file: currentFile,
          line: lineNum,
          severity: m.severity,
          message: 'name' in m ? m.name : ('id' in m ? m.id : 'issue'),
          fixHint: m.fixHint,
        });
      }
    } else if (!line.startsWith('-')) {
      lineNum++;
    }
  }

  if (findings.length === 0) {
    console.log(chalk.green('\n  No issues found in diff ✓\n'));
    return;
  }

  console.log(chalk.bold(`\n  SORK Diff Review — ${findings.length} issue(s) found\n`));
  for (const f of findings.slice(0, 10)) {
    const color = f.severity === 'CRITICAL' ? chalk.bgRed.white : f.severity === 'HIGH' ? chalk.red : chalk.yellow;
    console.log(`  ${color(f.severity)} ${f.file}:${f.line} — ${f.message}`);
    console.log(`  ${chalk.cyan('Fix:')} ${f.fixHint}\n`);
  }
}
