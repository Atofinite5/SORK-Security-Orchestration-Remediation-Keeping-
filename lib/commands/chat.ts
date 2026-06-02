/**
 * SORK Interactive Chat — Claude Code-like REPL
 *
 * `sork chat` opens an interactive terminal session with the SORK harness.
 * Supports: chat, file attachment, inline commands, streaming responses.
 */

import { createInterface } from 'readline';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { randomUUID } from 'crypto';
import { resolveAIConfig, KEY_SIGNUP_URL } from '../config/index.js';

const API_BASE = process.env.SORK_API_URL ?? 'https://sork-back.onrender.com';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentStep {
  agent: string;
  tier: 'fast' | 'deep' | 'embed';
  status: string;
  durationMs?: number;
  detail?: string;
}

let sessionId: string = randomUUID();
let history: ChatMessage[] = [];
let pendingFixCode: string | undefined;
let pendingFixTriage: unknown | undefined;
let pendingFixFilePath: string | undefined;
let pendingFixedCode: string | undefined;

const tierIcon = (t: string) =>
  t === 'fast' ? chalk.yellow('⚡') : t === 'deep' ? chalk.magenta('🧠') : chalk.cyan('🛡');

// Severity color helper — used by printReply for inline formatting
void ((s: string) =>
  s === 'critical'
    ? chalk.bgRed.white
    : s === 'high'
      ? chalk.red
      : s === 'medium'
        ? chalk.yellow
        : chalk.dim);

async function getApiKey(): Promise<string> {
  const ai = await resolveAIConfig();
  if (!ai?.apiKey) {
    console.log(chalk.yellow('\n  No API key configured.'));
    console.log(chalk.dim(`  Get one at: ${KEY_SIGNUP_URL}`));
    console.log(chalk.dim('  Then run:  sork config set-key <YOUR_KEY>\n'));
    process.exit(1);
  }
  return ai.apiKey;
}

async function readFileForAttachment(
  filePath: string
): Promise<{ name: string; content: string; size: number } | null> {
  try {
    const resolved = path.resolve(filePath);
    const stat = await fs.stat(resolved);
    if (stat.size > 100_000) {
      console.log(
        chalk.yellow(`  ⚠ File too large (${(stat.size / 1024).toFixed(1)}KB), max 100KB`)
      );
      return null;
    }
    const content = await fs.readFile(resolved, 'utf-8');
    return { name: path.basename(resolved), content, size: stat.size };
  } catch {
    console.log(chalk.red(`  ✗ Cannot read: ${filePath}`));
    return null;
  }
}

function printSteps(steps: AgentStep[]): void {
  if (steps.length === 0) return;
  const line = steps
    .map((s) => {
      const icon = tierIcon(s.tier);
      const dur = s.durationMs ? chalk.dim(` ${s.durationMs}ms`) : '';
      const st =
        s.status === 'done'
          ? chalk.green('✓')
          : s.status === 'error'
            ? chalk.red('✗')
            : chalk.dim('○');
      return `${icon} ${st} ${chalk.dim(s.agent)}${dur}`;
    })
    .join('  ');
  console.log(`  ${line}`);
}

function printReply(text: string): void {
  // Simple markdown-to-terminal rendering
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('## ')) {
      console.log(chalk.bold.cyan(`\n  ${line.slice(3)}`));
    } else if (line.startsWith('### ')) {
      console.log(chalk.bold(`\n  ${line.slice(4)}`));
    } else if (line.startsWith('> ')) {
      console.log(chalk.dim(`  │ ${line.slice(2)}`));
    } else if (line.startsWith('```')) {
      // toggle code block
      if (line.length > 3) {
        console.log(chalk.dim(`  ┌─ ${line.slice(3)}`));
      } else {
        console.log(chalk.dim('  └─'));
      }
    } else if (line.startsWith('- ') || line.startsWith('– ')) {
      console.log(`  ${chalk.cyan('•')} ${line.slice(2)}`);
    } else if (line.match(/^🔴|🟠|🟡|🟢/)) {
      console.log(`  ${line}`);
    } else if (line.trim() === '') {
      console.log('');
    } else {
      // Bold markdown
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
        .replace(/`(.+?)`/g, (_, t) => chalk.cyan(t));
      console.log(`  ${formatted}`);
    }
  }
}

function printDiff(original: string, fixed: string, filePath: string): void {
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');

  console.log(chalk.bold(`\n  ┌─ Diff: ${path.basename(filePath)} ──────────────────`));
  console.log(chalk.dim(`  │ ${filePath}`));
  console.log(chalk.dim('  │'));

  // Simple line-by-line diff — show removed/added lines with context
  const maxLen = Math.max(origLines.length, fixedLines.length);
  let changeCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const fixedLine = fixedLines[i];

    if (origLine === fixedLine) {
      // Unchanged — show context lines near changes (within 2 lines)
      const nearChange =
        (i > 0 && origLines[i - 1] !== fixedLines[i - 1]) ||
        (i > 1 && origLines[i - 2] !== fixedLines[i - 2]) ||
        (i < maxLen - 1 && origLines[i + 1] !== fixedLines[i + 1]) ||
        (i < maxLen - 2 && origLines[i + 2] !== fixedLines[i + 2]);
      if (nearChange && origLine !== undefined) {
        const lineNum = String(i + 1).padStart(4, ' ');
        console.log(chalk.dim(`  │ ${lineNum} │ ${origLine}`));
      }
    } else {
      changeCount++;
      const lineNum = String(i + 1).padStart(4, ' ');
      if (origLine !== undefined) {
        console.log(chalk.red(`  │ ${lineNum} │ - ${origLine}`));
      }
      if (fixedLine !== undefined) {
        console.log(chalk.green(`  │ ${lineNum} │ + ${fixedLine}`));
      }
    }
  }

  console.log(chalk.dim('  │'));
  console.log(chalk.bold(`  └─ ${changeCount} line(s) changed ──────────────────────\n`));
}

async function applyFix(
  filePath: string,
  fixedCode: string,
  rl: ReturnType<typeof createInterface>
): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(chalk.yellow(`\n  ⚠ This will overwrite: ${chalk.bold(filePath)}`));
    console.log(chalk.dim('  A backup will be saved as <file>.sork-backup\n'));
    rl.question(chalk.yellow('  Apply fix? [y/N] '), async (answer: string) => {
      if (answer.trim().toLowerCase() !== 'y') {
        console.log(chalk.dim('  Cancelled — no changes made.\n'));
        resolve(false);
        return;
      }

      try {
        const resolved = path.resolve(filePath);
        // Create backup
        const backupPath = resolved + '.sork-backup';
        const original = await fs.readFile(resolved, 'utf-8');
        await fs.writeFile(backupPath, original, 'utf-8');
        console.log(chalk.dim(`  📋 Backup saved: ${path.basename(backupPath)}`));

        // Write the fix
        await fs.writeFile(resolved, fixedCode, 'utf-8');
        console.log(chalk.green(`  ✓ Fix applied to ${path.basename(resolved)}`));
        console.log(chalk.dim(`  Tip: run ${chalk.cyan(`/scan ${filePath}`)} to verify the fix\n`));
        resolve(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Write failed';
        console.log(chalk.red(`  ✗ ${msg}\n`));
        resolve(false);
      }
    });
  });
}

async function sendMessage(
  apiKey: string,
  message: string,
  attachments: { name: string; content: string; size: number }[] = []
): Promise<void> {
  const payload: Record<string, unknown> = {
    message,
    sessionId,
    hasAttachments: attachments.length > 0,
  };
  if (attachments.length > 0) payload.attachedFiles = attachments;
  if (pendingFixCode) payload.pendingFixCode = pendingFixCode;
  if (pendingFixTriage) payload.pendingFixTriage = pendingFixTriage;

  try {
    const res = await fetch(`${API_BASE}/api/cli/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      console.log(chalk.red(`\n  ✗ ${err.error ?? `HTTP ${res.status}`}\n`));
      return;
    }

    const data = (await res.json()) as {
      reply: string;
      sessionId: string;
      intent?: string;
      steps?: AgentStep[];
      fixProposal?: {
        originalCode: string;
        fixedCode: string;
        score: number;
        recommendation: string;
        explanation: string;
        generatedTest?: { testCode: string; framework: string; description: string };
      };
      awaitingFixConfirmation?: boolean;
      durationMs?: number;
    };

    sessionId = data.sessionId;

    // Print agent steps
    if (data.steps) printSteps(data.steps);
    console.log('');

    // Print intent badge
    if (data.intent && data.intent !== 'general') {
      console.log(
        `  ${chalk.bgCyan.black(` ${data.intent.toUpperCase()} `)} ${chalk.dim(`${data.durationMs ?? 0}ms`)}\n`
      );
    }

    // Print reply
    printReply(data.reply);

    // Fix proposal summary
    if (data.fixProposal) {
      const fp = data.fixProposal;
      console.log(chalk.green(`\n  ┌─ Fix Proposal ─────────────────────`));
      console.log(chalk.green(`  │ Score: ${fp.score}/100 | ${fp.recommendation.toUpperCase()}`));
      console.log(chalk.green(`  │ ${fp.explanation}`));
      console.log(chalk.green(`  └──────────────────────────────────────`));

      if (fp.generatedTest) {
        console.log(chalk.blue(`\n  ┌─ Security Test (${fp.generatedTest.framework}) ──────`));
        console.log(chalk.blue(`  │ ${fp.generatedTest.description}`));
        console.log(chalk.blue(`  └──────────────────────────────────────`));
        lastGeneratedTest = {
          testCode: fp.generatedTest.testCode,
          framework: fp.generatedTest.framework,
        };
        console.log(chalk.dim(`\n  Type ${chalk.cyan('/save-test <path>')} to save the test file`));
      }

      pendingFixCode = fp.originalCode;
      pendingFixedCode = fp.fixedCode;
      pendingFixTriage = undefined;

      // Show inline diff if we know the file path
      if (pendingFixFilePath && fp.originalCode && fp.fixedCode) {
        printDiff(fp.originalCode, fp.fixedCode, pendingFixFilePath);
        console.log(
          chalk.cyan(
            `  → Type ${chalk.bold('/apply')} to write the fix to disk, or ${chalk.bold('/diff')} to see it again`
          )
        );
      }
    }

    // Awaiting fix confirmation
    if (data.awaitingFixConfirmation) {
      console.log(
        chalk.yellow(
          `\n  → Type ${chalk.bold('"fix it"')} for SORK to auto-fix, or ${chalk.bold('"I\'ll fix it"')} to handle yourself`
        )
      );
      pendingFixCode = undefined; // Will be set by triage context on the server
    }

    // Store in history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: data.reply.slice(0, 500) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    console.log(chalk.red(`\n  ✗ ${msg}`));
    console.log(chalk.dim('  Check your internet connection and API key.\n'));
  }
}

function showChatHelp(): void {
  console.log(chalk.bold('\n  SORK Chat Commands\n'));
  console.log(chalk.dim('  ── Scan & Fix ──────────────────────────────'));
  console.log(`  ${chalk.cyan('/file <path>')}        Attach a file to analyze`);
  console.log(`  ${chalk.cyan('/scan <path>')}        Quick-scan a file`);
  console.log(`  ${chalk.cyan('/fix <path>')}         Scan + auto-fix a file`);
  console.log(`  ${chalk.cyan('/apply')}              Apply pending fix to disk`);
  console.log(`  ${chalk.cyan('/diff')}               Show pending fix diff`);
  console.log(`  ${chalk.cyan('/undo')}               Revert last applied fix`);
  console.log(`  ${chalk.cyan('/save-test <path>')}   Save last generated test`);
  console.log(chalk.dim('  ── Session ─────────────────────────────────'));
  console.log(`  ${chalk.cyan('/model')}              Show current model`);
  console.log(`  ${chalk.cyan('/model <name>')}       Switch model`);
  console.log(`  ${chalk.cyan('/search <query>')}     Search security advisories`);
  console.log(`  ${chalk.cyan('/history')}            Show conversation history`);
  console.log(`  ${chalk.cyan('/clear')}              Clear conversation`);
  console.log(`  ${chalk.cyan('/help')}               Show this help`);
  console.log(`  ${chalk.cyan('/exit')}               Exit chat\n`);
  console.log(chalk.dim('  Or just type naturally — SORK auto-detects intent.\n'));
}

let lastGeneratedTest: { testCode: string; framework: string } | undefined;

export async function startChat(): Promise<void> {
  const apiKey = await getApiKey();

  console.log(chalk.cyan('\n  ┌──────────────────────────────────────────────┐'));
  console.log(
    chalk.cyan('  │') +
      chalk.bold('  SORK Interactive Chat                        ') +
      chalk.cyan('│')
  );
  console.log(
    chalk.cyan('  │') +
      chalk.dim('  AI Security Engineer — ask anything           ') +
      chalk.cyan('│')
  );
  console.log(
    chalk.cyan('  │') +
      chalk.dim('  /help for commands · /exit to quit            ') +
      chalk.cyan('│')
  );
  console.log(chalk.cyan('  └──────────────────────────────────────────────┘\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('  sork > '),
    historySize: 100,
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      const arg = args.join(' ').trim();

      switch (cmd) {
        case 'exit':
        case 'quit':
        case 'q':
          console.log(chalk.dim('\n  Goodbye. Stay secure. 🛡\n'));
          rl.close();
          process.exit(0);
          break;

        case 'help':
          showChatHelp();
          break;

        case 'clear':
          history = [];
          sessionId = randomUUID();
          pendingFixCode = undefined;
          pendingFixTriage = undefined;
          pendingFixFilePath = undefined;
          pendingFixedCode = undefined;
          lastGeneratedTest = undefined;
          console.log(chalk.dim('  Conversation cleared.\n'));
          break;

        case 'history':
          if (history.length === 0) {
            console.log(chalk.dim('  No history yet.\n'));
          } else {
            for (const m of history.slice(-20)) {
              const prefix = m.role === 'user' ? chalk.green('  you >') : chalk.cyan('  sork >');
              console.log(`${prefix} ${m.content.slice(0, 120)}`);
            }
            console.log('');
          }
          break;

        case 'file': {
          if (!arg) {
            console.log(chalk.yellow('  Usage: /file <path>'));
            break;
          }
          const file = await readFileForAttachment(arg);
          if (file) {
            console.log(
              chalk.dim(`  📎 Attached: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)
            );
            console.log(chalk.dim('  Now type your question about this file.\n'));
            // Store for next message
            (rl as any).__pendingAttachments = [file];
          }
          break;
        }

        case 'scan': {
          if (!arg) {
            console.log(chalk.yellow('  Usage: /scan <path>'));
            break;
          }
          const file = await readFileForAttachment(arg);
          if (file) {
            pendingFixFilePath = path.resolve(arg);
            console.log(chalk.dim(`  🔍 Scanning ${file.name}...\n`));
            await sendMessage(
              apiKey,
              `Scan this file for security vulnerabilities:\n\nAttached files: ${file.name}`,
              [file]
            );
          }
          break;
        }

        case 'fix': {
          if (!arg) {
            console.log(chalk.yellow('  Usage: /fix <path>'));
            break;
          }
          const file = await readFileForAttachment(arg);
          if (file) {
            pendingFixFilePath = path.resolve(arg);
            console.log(chalk.dim(`  🔧 Scanning + fixing ${file.name}...\n`));
            await sendMessage(
              apiKey,
              `Fix all security vulnerabilities in this file:\n\nAttached files: ${file.name}`,
              [file]
            );
          }
          break;
        }

        case 'model': {
          if (!arg) {
            try {
              const res = await fetch(`${API_BASE}/api/cli/chat/model`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              });
              const data = (await res.json()) as { model: string };
              console.log(chalk.dim(`  Current model: ${chalk.cyan(data.model ?? 'default')}\n`));
            } catch {
              console.log(chalk.red('  ✗ Failed to fetch model info\n'));
            }
          } else {
            await sendMessage(apiKey, `Switch model to ${arg}`);
          }
          break;
        }

        case 'search': {
          if (!arg) {
            console.log(chalk.yellow('  Usage: /search <query>'));
            break;
          }
          console.log(chalk.dim(`  🔎 Searching: ${arg}\n`));
          await sendMessage(apiKey, `Search for security information about: ${arg}`);
          break;
        }

        case 'save-test': {
          if (!lastGeneratedTest) {
            console.log(chalk.yellow('  No test to save. Run /fix first.\n'));
            break;
          }
          const testPath =
            arg ||
            `sork-security-test.${lastGeneratedTest.framework === 'pytest' ? 'py' : 'test.ts'}`;
          try {
            await fs.writeFile(testPath, lastGeneratedTest.testCode, 'utf-8');
            console.log(chalk.green(`  ✓ Test saved to ${testPath}\n`));
          } catch {
            console.log(chalk.red(`  ✗ Cannot write: ${testPath}\n`));
          }
          break;
        }

        case 'apply': {
          if (!pendingFixedCode || !pendingFixFilePath) {
            console.log(chalk.yellow('  No pending fix to apply.'));
            console.log(chalk.dim('  Run /fix <path> first to generate a fix proposal.\n'));
            break;
          }
          // Show the diff before asking
          printDiff(pendingFixCode ?? '', pendingFixedCode, pendingFixFilePath);
          const applied = await applyFix(pendingFixFilePath, pendingFixedCode, rl);
          if (applied) {
            // Clear pending state after successful apply
            pendingFixCode = undefined;
            pendingFixedCode = undefined;
            // Keep pendingFixFilePath so /scan can re-verify the same file
          }
          break;
        }

        case 'diff': {
          if (!pendingFixedCode || !pendingFixFilePath || !pendingFixCode) {
            console.log(chalk.yellow('  No pending fix to show.'));
            console.log(chalk.dim('  Run /fix <path> first to generate a fix proposal.\n'));
            break;
          }
          printDiff(pendingFixCode, pendingFixedCode, pendingFixFilePath);
          console.log(chalk.cyan(`  → Type ${chalk.bold('/apply')} to write the fix to disk\n`));
          break;
        }

        case 'undo': {
          if (!pendingFixFilePath) {
            console.log(chalk.yellow('  No recent fix to undo.\n'));
            break;
          }
          const backupPath = path.resolve(pendingFixFilePath) + '.sork-backup';
          try {
            const backup = await fs.readFile(backupPath, 'utf-8');
            await fs.writeFile(path.resolve(pendingFixFilePath), backup, 'utf-8');
            await fs.unlink(backupPath);
            console.log(
              chalk.green(`  ✓ Restored ${path.basename(pendingFixFilePath)} from backup`)
            );
            console.log(chalk.dim(`  Backup file removed.\n`));
          } catch {
            console.log(chalk.red(`  ✗ No backup found at ${backupPath}\n`));
          }
          break;
        }

        default:
          console.log(chalk.yellow(`  Unknown command: /${cmd}`));
          console.log(chalk.dim('  Type /help for available commands.\n'));
      }

      rl.prompt();
      return;
    }

    // Regular message — check for pending attachments
    const attachments = (rl as any).__pendingAttachments ?? [];
    (rl as any).__pendingAttachments = undefined;

    console.log(''); // spacing
    await sendMessage(apiKey, input, attachments);
    console.log(''); // spacing
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.dim('\n  Session ended. Stay secure. 🛡\n'));
    process.exit(0);
  });
}
