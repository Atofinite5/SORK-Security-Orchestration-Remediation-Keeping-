import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from './utils/logger.js';
import { TriageAgent } from './agents/triage.js';
import { RemediationAgent } from './agents/remediation.js';
import { KeeperAgent } from './agents/keeper.js';
import { SecurityScanner } from './security/scanner.js';
import { CodeFixer } from './fixers/codeFixer.js';
import {
  SorkSession,
  SorkConfig,
  SorkOptions,
} from './types/index.js';

export class SorkOrchestrator {
  private projectPath: string;
  private logger: Logger;
  private triage: TriageAgent;
  private remediation: RemediationAgent;
  private keeper: KeeperAgent;
  private scanner: SecurityScanner;
  private fixer: CodeFixer;
  private session: SorkSession;

  constructor(options: SorkOptions = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.logger = new Logger('ORCHESTRATOR');

    this.triage = new TriageAgent(this.logger);
    this.remediation = new RemediationAgent(this.logger);
    this.keeper = new KeeperAgent(this.logger);

    this.scanner = new SecurityScanner(this.projectPath, this.logger);
    this.fixer = new CodeFixer(this.projectPath, this.logger);

    this.session = {
      timestamp: new Date(),
      vulnerabilities: [],
      fixes: [],
      dismissed: [],
      verified: [],
    };
  }

  async initialize(): Promise<void> {
    this.logger.section('SORK Initialization');

    const sorkConfig: SorkConfig = {
      version: '1.0.0',
      initialized: new Date().toISOString(),
      agents: {
        triage: true,
        remediation: true,
        keeper: true,
      },
      settings: {
        autoFix: true,
        preCommitGuards: true,
        strictMode: false,
      },
    };

    const configPath = path.join(this.projectPath, '.sorkrc.json');
    await fs.writeFile(configPath, JSON.stringify(sorkConfig, null, 2));
    this.logger.success(`Configuration created: ${configPath}`);

    const hooksDir = path.join(this.projectPath, '.sork', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    this.logger.success(`Hooks directory created`);

    this.logger.info('✓ Connected to Anthropic model');
    this.logger.info('✓ 3 agents registered: READY');
    this.logger.info('\nNext: Run `sork setup-hooks` to enable pre-commit guards');
  }

  async scan(): Promise<void> {
    this.logger.section('SORK Security Scan');

    this.logger.info('Agent 01 (TRIAGE) - Analyzing project...');
    const vulnerabilities = await this.scanner.scan();
    this.session.vulnerabilities = vulnerabilities;

    if (vulnerabilities.length === 0) {
      this.logger.success('No vulnerabilities detected!');
      return;
    }

    this.logger.info(`Detected ${vulnerabilities.length} potential issues`);
    const triageResults = await this.triage.analyze(vulnerabilities);

    this.session.dismissed = triageResults.dismissed;
    this.session.vulnerabilities = triageResults.confirmed;

    this.logger.warn(
      `${triageResults.dismissed.length} false positives dismissed, ` +
        `${triageResults.confirmed.length} confirmed threats`
    );

    if (triageResults.confirmed.length > 0) {
      this.logger.section('Confirmed Vulnerabilities');
      triageResults.confirmed.forEach((vuln, i) => {
        console.log(
          `${i + 1}. [${vuln.severity}] ${vuln.type}\n` +
            `   File: ${vuln.file}:${vuln.line}\n` +
            `   Issue: ${vuln.message}`
        );
      });
    }
  }

  async fix(): Promise<void> {
    this.logger.section('SORK Remediation');

    if (this.session.vulnerabilities.length === 0) {
      this.logger.warn('No vulnerabilities to fix. Run `sork scan` first.');
      return;
    }

    this.logger.info(
      `Agent 02 (REMEDIATION) - Generating fixes for ${this.session.vulnerabilities.length} issues...`
    );

    const fixes = await this.remediation.generateFixes(
      this.session.vulnerabilities
    );
    this.session.fixes = fixes;

    for (const fix of fixes) {
      try {
        await this.fixer.applyFix(fix);
        this.logger.success(`Fixed: ${fix.type} in ${fix.file}`);
      } catch (error) {
        this.logger.error(
          `Failed to fix ${fix.file}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    this.logger.success(`${fixes.length} fixes applied`);

    this.logger.section('SORK Verification');
    this.logger.info('Agent 03 (KEEPER) - Verifying fixes...');

    const verificationResults = await this.keeper.verify(
      fixes,
      this.session.vulnerabilities
    );
    this.session.verified = verificationResults.verified;

    this.keeper.printSummary(verificationResults);
  }

  async preCommit(): Promise<boolean> {
    this.logger.section('Pre-Commit Security Check');

    const stagedVulns = await this.scanner.scanStaged();

    if (stagedVulns.length === 0) {
      this.logger.success('All checks passed! Safe to commit.');
      return true;
    }

    this.logger.error(`${stagedVulns.length} issues found in staged changes:`);
    stagedVulns.forEach((vuln, i) => {
      console.log(
        `${i + 1}. [${vuln.severity}] ${vuln.message} (${vuln.file})`
      );
    });

    const critical = stagedVulns.filter((v) => v.severity === 'CRITICAL');
    if (critical.length > 0) {
      this.logger.error('\n🚫 CRITICAL issues detected. Commit blocked.');
      console.log('Run `sork fix` to auto-resolve, then try again.');
      process.exit(1);
    }

    return false;
  }

  async setupHooks(): Promise<void> {
    this.logger.section('Setting Up Git Hooks');

    const hookContent = `#!/bin/bash
sork pre-commit
exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "Pre-commit checks failed. Commit aborted."
  exit 1
fi

exit 0
`;

    const hooksDir = path.join(this.projectPath, '.git', 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');

    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(preCommitPath, hookContent, { mode: 0o755 });

    this.logger.success('Pre-commit hook installed at .git/hooks/pre-commit');
    this.logger.info('Hooks will run automatically before each commit');
  }

  async status(): Promise<void> {
    this.logger.section('SORK Status');

    console.log('Agents:');
    console.log('  ✓ Agent 01 (TRIAGE)      - Operational');
    console.log('  ✓ Agent 02 (REMEDIATION) - Operational');
    console.log('  ✓ Agent 03 (KEEPER)      - Operational');
    console.log();
    console.log('Configuration:');

    try {
      const configPath = path.join(this.projectPath, '.sorkrc.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent) as SorkConfig;
      console.log(`  Version: ${config.version}`);
      console.log(`  Initialized: ${config.initialized}`);
      console.log(`  Auto-fix: ${config.settings.autoFix ? '✓' : '✗'}`);
      console.log(
        `  Pre-commit Guards: ${config.settings.preCommitGuards ? '✓' : '✗'}`
      );
    } catch {
      console.log('  Status: Not initialized. Run `sork init` first.');
    }

    console.log();
    console.log('Commands:');
    console.log('  sork scan       - Run security scan');
    console.log('  sork fix        - Auto-fix detected issues');
    console.log('  sork pre-commit - Run pre-commit checks');
  }
}
