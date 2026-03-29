#!/usr/bin/env node

import chalk from 'chalk';
import minimist from 'minimist';
import { SorkOrchestrator } from '../lib/orchestrator.js';
import { Logger } from '../lib/utils/logger.js';
import { SorkOptions } from '../lib/types/index.js';

const logger = new Logger('SORK');

interface CliArgs {
  help?: boolean;
  version?: boolean;
  path?: string;
  model?: string;
  _: string[];
  [key: string]: unknown;
}

const argv: CliArgs = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    v: 'version',
    p: 'path',
    m: 'model',
  },
  default: {
    path: '.',
    model: 'anthropic',
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
  `),
  );
  console.log(chalk.bold('Security Orchestration, Remediation & Keeping'));
  console.log(chalk.dim('Global AI Security Brain for Node Projects\n'));
}

function showHelp(): void {
  console.log(chalk.bold('Usage: sork [command] [options]\n'));
  console.log(chalk.bold('Commands:'));
  console.log('  init                Initialize SORK in current project');
  console.log('  scan                Run security scan on project');
  console.log('  fix                 Auto-fix detected issues');
  console.log('  status              Show SORK status');
  console.log('  pre-commit          Run pre-commit hooks (auto-called)');
  console.log('  setup-hooks         Install git pre-commit hooks\n');

  console.log(chalk.bold('Options:'));
  console.log('  --path <dir>        Project path (default: current)');
  console.log('  --model <model>     AI model to use (anthropic|local)');
  console.log('  -v, --version       Show version');
  console.log('  -h, --help          Show this help\n');

  console.log(chalk.bold('Examples:'));
  console.log('  sork init');
  console.log('  sork scan --path ./my-project');
  console.log('  sork fix --model anthropic');
  console.log('  sork setup-hooks\n');
}

async function main(): Promise<void> {
  try {
    showBanner();

    if (argv.help) {
      showHelp();
      process.exit(0);
    }

    if (argv.version) {
      console.log('SORK v1.0.0');
      process.exit(0);
    }

    const command =
      (typeof argv._[0] === 'string' ? argv._[0] : String(argv._[0])) || 'status';

    const projectPath = argv.path as string;
    if (projectPath && (projectPath.includes('..') || projectPath.startsWith('/'))) {
      logger.error('Invalid path: use relative paths only (e.g., . or ./my-project)');
      process.exit(1);
    }

    const options: SorkOptions = {
      projectPath,
      model: (argv.model as 'anthropic' | 'local') || 'anthropic',
    };

    const orchestrator = new SorkOrchestrator(options);

    switch (command) {
    case 'init':
      logger.info('Initializing SORK in project...');
      await orchestrator.initialize();
      logger.success(
        'SORK initialized! Run `sork setup-hooks` to enable pre-commit guards.',
      );
      break;

    case 'scan':
      logger.info('Running security scan...');
      await orchestrator.scan();
      break;

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

    default:
      logger.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
    }
  } catch (error) {
    logger.error(
      `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown error occurred';
  logger.error(`Fatal error: ${message}`);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});
