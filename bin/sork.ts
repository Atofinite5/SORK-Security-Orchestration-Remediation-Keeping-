#!/usr/bin/env node

import chalk from 'chalk';
import minimist from 'minimist';
import { SorkOrchestrator } from '../lib/orchestrator.js';
import { NAgentManager } from '../lib/agents/nAgentManager.js';
import { Logger } from '../lib/utils/logger.js';
import { SorkOptions } from '../lib/types/index.js';
import {
  loadConfig,
  saveConfig,
  setConfigValue,
  setApiKey,
  resolveAIConfig,
  configFilePath,
  redactKey,
  KEY_SIGNUP_URL,
  AIConfig,
} from '../lib/config/index.js';
import { hookVscode } from '../lib/commands/hook.js';
import { sendToCloud, sendFolderToCloud } from '../lib/commands/send.js';
import { guardProject } from '../lib/commands/guard.js';
import { reviewFile, reviewStagedFiles } from '../lib/commands/review.js';
import { runDoctor } from '../lib/commands/doctor.js';
import { detectLanguage, scanWithLanguagePatterns } from '../lib/scanners/languages.js';
import { runStabilityChecks } from '../lib/scanners/stability.js';
import { promises as nodeFs } from 'fs';

const logger = new Logger('SORK');

interface CliArgs {
  help?: boolean;
  version?: boolean;
  path?: string;
  _: string[];
  [key: string]: unknown;
}

const argv: CliArgs = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    v: 'version',
    p: 'path',
  },
  default: {
    path: '.',
  },
}) as CliArgs;

function showBanner(): void {
  console.log(
    chalk.cyan(`
 ███████╗  ██████╗  ██████╗  ██╗  ██╗
 ██╔════╝ ██╔═══██╗ ██╔══██╗ ██║ ██╔╝
 ███████╗ ██║   ██║ ██████╔╝ █████╔╝
 ╚════██║ ██║   ██║ ██╔══██╗ ██╔═██╗
 ███████║ ╚██████╔╝ ██║  ██║ ██║  ██╗
 ╚══════╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝
  `)
  );
  console.log(chalk.bold('Security Orchestration, Remediation & Keeping'));
  console.log(chalk.dim('AI-powered security pipeline created by atofinite5\n'));
}

async function handleConfigCommand(args: string[]): Promise<void> {
  const sub = args[0] ?? 'list';

  switch (sub) {
    case 'list': {
      const config = await loadConfig();
      const resolved = await resolveAIConfig();
      console.log(chalk.bold('\nSORK config') + chalk.dim(` (${configFilePath()})\n`));
      const hasCohereFallback = Boolean(
        process.env.COHERE_API_KEY || process.env.SORK_COHERE_API_KEY
      );
      if (!config.ai && !resolved && !hasCohereFallback) {
        console.log(chalk.yellow('  No API key configured.'));
        console.log(chalk.dim('\n  Get a free API key:  ' + KEY_SIGNUP_URL));
        console.log(chalk.dim('  Then run:            sork config set-key <YOUR_KEY>'));
        return;
      }
      if (!resolved && hasCohereFallback) {
        console.log(`  mode         ${chalk.cyan('Cohere fallback')}`);
        console.log('  apiKey       (set by env var)');
        console.log(`  model        ${process.env.COHERE_MODEL ?? 'command-a-03-2025'}`);
        return;
      }
      const ai = resolved!;
      const isCloud = ai.apiKey.startsWith('sork_live_');
      console.log(`  mode         ${isCloud ? chalk.cyan('SORK Cloud (managed)') : 'BYOK direct'}`);
      console.log(`  apiKey       ${redactKey(ai.apiKey)}`);
      if (!isCloud) {
        console.log(`  model        ${ai.model}`);
        console.log(`  temperature  ${ai.temperature}`);
        console.log(`  maxTokens    ${ai.maxTokens}`);
      }
      if (process.env.SORK_API_KEY) {
        console.log(chalk.dim('\n  (apiKey overridden by SORK_API_KEY env var)'));
      }
      if (process.env.COHERE_API_KEY || process.env.SORK_COHERE_API_KEY) {
        console.log(chalk.dim('  (Cohere fallback enabled by env var)'));
      }
      return;
    }

    case 'get': {
      const key = args[1];
      if (!key) {
        throw new Error('Usage: sork config get <key>');
      }
      const ai = await resolveAIConfig();
      if (!ai) {
        console.log(chalk.yellow('No API key configured. Run: sork config set-key <YOUR_KEY>'));
        return;
      }
      const value = (ai as unknown as Record<string, unknown>)[key];
      if (key === 'apiKey') {
        console.log(redactKey(String(value ?? '')));
      } else {
        console.log(value ?? '(unset)');
      }
      return;
    }

    case 'set-key': {
      const apiKey = args[1];
      if (!apiKey) {
        throw new Error(
          `Usage: sork config set-key <YOUR_API_KEY>\n  Get a free API key at: ${KEY_SIGNUP_URL}`
        );
      }
      const ai = await setApiKey(apiKey);
      logger.success('API key saved');
      console.log(`  apiKey   ${redactKey(ai.apiKey)}`);
      console.log(`  model    ${ai.model}`);
      console.log(chalk.dim(`  (saved to ${configFilePath()} with mode 0600)`));
      return;
    }

    case 'set': {
      const key = args[1] as keyof AIConfig | undefined;
      const value = args[2];
      if (!key || value === undefined) {
        throw new Error('Usage: sork config set <apiKey|model|temperature|maxTokens> <value>');
      }
      const numericKeys = ['temperature', 'maxTokens'];
      const parsed = numericKeys.includes(key) ? Number(value) : value;
      await setConfigValue(key, parsed);
      logger.success(`Set ${key} → ${key === 'apiKey' ? redactKey(value) : parsed}`);
      return;
    }

    case 'path':
      console.log(configFilePath());
      return;

    case 'clear':
      await saveConfig({});
      logger.success('Config cleared');
      return;

    default:
      console.log(chalk.bold('sork config <subcommand>\n'));
      console.log('  set-key <api_key>      Save your API key (primary onboarding)');
      console.log('  list                   Show current config');
      console.log('  get <key>              Get a single value');
      console.log('  set <key> <value>      Set a single value (model, temperature, ...)');
      console.log('  path                   Show config file path');
      console.log('  clear                  Wipe config\n');
      console.log(chalk.dim(`Get a free API key at: ${KEY_SIGNUP_URL}`));
      return;
  }
}

function showHelp(): void {
  console.log(chalk.bold('Usage: sork [command] [options]\n'));
  console.log(chalk.bold('Commands:'));
  console.log('  init                Initialize SORK in current project');
  console.log('  init-claude-agent   Initialize Claude agent');
  console.log('  init-openai-agent Initialize OpenAI agent');
  console.log('  init-codex-agent  Initialize Codex agent');
  console.log('  init-gemini-agent Initialize Gemini agent');
  console.log('  init-mistral-agent Initialize Mistral agent');
  console.log('  init-llama-agent  Initialize Llama agent');
  console.log('  list-agents       List all initialized agents');
  console.log('  config            Manage AI provider config (BYOK)');
  console.log('  scan              Run security scan on project');
  console.log('  fix               Auto-fix detected issues');
  console.log('  status            Show SORK status');
  console.log('  pre-commit        Run pre-commit hooks (auto-called)');
  console.log('  setup-hooks       Install git pre-commit hooks');
  console.log('  hook vscode       Add SORK tasks to .vscode/tasks.json');
  console.log('  send [file]       Send a file/folder to SORK Cloud dashboard');
  console.log('  guard             Watch files in real-time, scan on save');
  console.log('  review [file]     Review a file or staged diff before committing');
  console.log('  doctor            Full project health check & language breakdown\n');

  console.log(chalk.bold('Languages supported:'));
  console.log('  TypeScript · JavaScript · Python · Rust · Go · Java · C/C++ · Ruby · PHP\n');

  console.log(chalk.bold('Options:'));
  console.log('  --path <dir>        Project path (default: current)');
  console.log('  -v, --version       Show version');
  console.log('  -h, --help          Show this help\n');

  console.log(chalk.bold('Examples:'));
  console.log('  sork init');
  console.log('  sork init-claude-agent');
  console.log('  sork init-openai-agent');
  console.log('  sork config set-key <YOUR_API_KEY>');
  console.log('  sork scan --path ./my-project');
  console.log('  sork setup-hooks');
  console.log('  sork hook vscode');
  console.log('  sork send ./src/auth.ts');
  console.log('  sork send ./src/');
  console.log('  sork guard');
  console.log('  sork review ./src/auth.ts');
  console.log('  sork review --staged');
  console.log('  sork doctor\n');
  console.log(chalk.dim(`  Get a free API key at: ${KEY_SIGNUP_URL}\n`));
}

async function main(): Promise<void> {
  try {
    showBanner();

    if (argv.help) {
      showHelp();
      process.exit(0);
    }

    if (argv.version) {
      console.log('SORK v1.3.0');
      process.exit(0);
    }

    const command = (typeof argv._[0] === 'string' ? argv._[0] : String(argv._[0])) || 'status';

    if (command === 'config') {
      await handleConfigCommand(argv._.slice(1));
      return;
    }

    const projectPath = argv.path as string;
    if (projectPath && (projectPath.includes('..') || projectPath.startsWith('/'))) {
      logger.error('Invalid path: use relative paths only (e.g., . or ./my-project)');
      process.exit(1);
    }

    const options: SorkOptions = {
      projectPath,
    };

    const orchestrator = new SorkOrchestrator(options);

    switch (command) {
      case 'init':
        logger.info('Initializing SORK in project...');
        await orchestrator.initialize();
        logger.success('SORK initialized! Run `sork setup-hooks` to enable pre-commit guards.');
        break;

      // Handle init-n-agent commands (init-claude-agent, init-openai-agent, etc.)
      case 'init-claude-agent':
      case 'init-openai-agent':
      case 'init-codex-agent':
      case 'init-gemini-agent':
      case 'init-mistral-agent':
      case 'init-llama-agent': {
        const agentManager = new NAgentManager(logger, projectPath);
        const agentName = agentManager.parseAgentName(command);
        if (agentName) {
          logger.info(`Initializing ${agentName} agent...`);
          const config = await agentManager.initializeAgent(agentName);
          if (config) {
            agentManager.printAgentInfo(config);
          }
        }
        break;
      }

      case 'list-agents': {
        const agentManager = new NAgentManager(logger, projectPath);
        const agents = await agentManager.listAgents();
        if (agents.length === 0) {
          console.log('No agents initialized yet.');
          console.log('Run: sork init-claude-agent, sork init-openai-agent, etc.');
        } else {
          console.log(chalk.bold('\nInitialized Agents:'));
          for (const agent of agents) {
            agentManager.printAgentInfo(agent);
          }
        }
        break;
      }

      case 'fix':
        logger.info('Auto-fixing issues...');
        await orchestrator.fix();
        logger.success('Auto-fix complete!');
        break;

      case 'pre-commit':
        logger.info('Running pre-commit checks...');
        await orchestrator.preCommit();
        break;

      case 'setup-hooks':
        logger.info('Setting up git hooks...');
        await orchestrator.setupHooks();
        logger.success('Git hooks installed!');
        break;

      case 'status':
        logger.info('Checking SORK status...');
        await orchestrator.status();
        break;

      case 'guard':
        await guardProject(projectPath);
        break;

      case 'review': {
        const target = argv._[1];
        const staged = argv.staged as boolean | undefined;
        if (staged || (!target && !staged)) {
          await reviewStagedFiles();
        } else if (target) {
          const result = await reviewFile(target);
          const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '✅';
          console.log(`\n  ${icon} ${result.verdict}: ${result.summary}`);
          for (const issue of result.topIssues) {
            console.log(`\n  ${chalk.bold(issue.severity)} Line ${issue.line}: ${issue.message}`);
            console.log(`  → ${issue.plain}`);
            console.log(`  ${chalk.cyan('Fix:')} ${issue.fixHint}`);
          }
          if (result.verdict === 'BLOCK') process.exitCode = 1;
        }
        break;
      }

      case 'doctor':
        await runDoctor(projectPath);
        break;

      // Multi-language scan: sork scan --file <path> or sork scan --lang <lang>
      case 'scan': {
        const file = argv.file as string | undefined;
        if (file) {
          logger.info(`Scanning ${file}...`);
          try {
            const source = await nodeFs.readFile(file, 'utf-8');
            const lang = detectLanguage(file);
            const vulns = scanWithLanguagePatterns(source, lang);
            const stability = runStabilityChecks(source, lang, file);
            const all = [...vulns, ...stability];

            if (all.length === 0) {
              logger.success(`No issues found in ${file} [${lang}]`);
              break;
            }

            console.log(chalk.bold(`\n  ${file} [${lang}] — ${all.length} issue(s)\n`));
            for (const issue of all) {
              const id = 'patternId' in issue ? issue.patternId : issue.id;
              const name = 'name' in issue ? issue.name : issue.category;
              const sev = issue.severity === 'CRITICAL' ? chalk.bgRed.white(` ${issue.severity} `)
                : issue.severity === 'HIGH' ? chalk.red(issue.severity)
                : issue.severity === 'MEDIUM' ? chalk.yellow(issue.severity)
                : chalk.dim(issue.severity);
              console.log(`  ${sev} [${id}] ${chalk.bold(name)} — Line ${issue.line}`);
              console.log(`  ${chalk.dim('→')} ${'plain' in issue ? issue.plain : issue.message}`);
              console.log(`  ${chalk.cyan('Fix:')} ${issue.fixHint}\n`);
            }
          } catch (e) {
            logger.error(`Cannot read file: ${file}`);
          }
          break;
        }
        // Fall through to original orchestrator scan
        logger.info('Running security scan...');
        await orchestrator.scan();
        break;
      }

      case 'hook': {
        const sub = argv._[1] ?? '';
        if (sub === 'vscode') {
          await hookVscode(projectPath);
        } else {
          console.log(chalk.bold('sork hook <target>\n'));
          console.log('  vscode    Add SORK tasks to .vscode/tasks.json');
        }
        break;
      }

      case 'send': {
        const target = argv._[1];
        if (target) {
          // Check if it's a directory
          try {
            const stat = await import('fs').then((m) => m.promises.stat(target));
            if (stat.isDirectory()) {
              await sendFolderToCloud(target);
            } else {
              await sendToCloud(target);
            }
          } catch {
            await sendToCloud(target);
          }
        } else {
          await sendToCloud();
        }
        break;
      }

      default:
        logger.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  logger.error(`Fatal error: ${message}`);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});
