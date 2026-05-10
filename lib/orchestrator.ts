import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from './utils/logger.js';
import { ProjectScaffolder } from './utils/scaffolder.js';
import { TriageAgent } from './agents/triage.js';
import { RemediationAgent } from './agents/remediation.js';
import { KeeperAgent } from './agents/keeper.js';
import { SecurityScanner } from './security/scanner.js';
import { CodeFixer } from './fixers/codeFixer.js';
import { AIClient, AIProvider } from './ai/client.js';
import { SorkSession, SorkConfig, SorkOptions, Vulnerability } from './types/index.js';

export class SorkOrchestrator {
  private projectPath: string;
  private logger: Logger;
  private scanner: SecurityScanner;
  private fixer: CodeFixer;
  private session: SorkSession;
  private ai: AIProvider | null = null;
  private aiInitialized = false;

  constructor(options: SorkOptions = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.logger = new Logger('ORCHESTRATOR');
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

  private async getAI(): Promise<AIProvider | null> {
    if (!this.aiInitialized) {
      this.ai = await AIClient.create(this.logger);
      this.aiInitialized = true;
      if (!this.ai) {
        this.logger.warn(
          'No API key configured — running in fallback mode (deterministic rules only)'
        );
        this.logger.info('  Configure with: sork config set-key <YOUR_API_KEY>');
      }
    }
    return this.ai;
  }

  async initialize(): Promise<void> {
    this.logger.section('SORK Initialization');

    const sorkConfig: SorkConfig = {
      version: '1.3.0',
      initialized: new Date().toISOString(),
      agents: { triage: true, remediation: true, keeper: true },
      settings: { autoFix: true, preCommitGuards: true, strictMode: false },
    };

    await fs.writeFile(
      path.join(this.projectPath, '.sorkrc.json'),
      JSON.stringify(sorkConfig, null, 2)
    );
    this.logger.success('Configuration created: .sorkrc.json');

    await fs.mkdir(path.join(this.projectPath, '.sork', 'hooks'), { recursive: true });
    this.logger.success('Hooks directory created');

    this.logger.info('');
    const scaffolder = new ProjectScaffolder(this.projectPath, this.logger);
    await scaffolder.scaffoldAll();

    this.logger.info('');
    this.logger.info('Next steps:');
    this.logger.info('  1. sork config set-key <YOUR_API_KEY>   (Cloud or BYOK)');
    this.logger.info('  2. sork scan                            (Run a security scan)');
    this.logger.info('  3. sork setup-hooks                     (Block unsafe commits)');
  }

  async scan(): Promise<void> {
    this.logger.section('SORK Security Scan');

    const ai = await this.getAI();
    const triage = new TriageAgent(this.logger, ai, this.projectPath);

    const vulnerabilities = await this.scanner.scan();
    this.session.vulnerabilities = vulnerabilities;

    if (vulnerabilities.length === 0) {
      this.logger.success('No vulnerabilities detected!');
      return;
    }

    this.logger.info(`Detected ${vulnerabilities.length} potential issue(s)`);
    const triageResults = await triage.analyze(vulnerabilities);

    this.session.dismissed = triageResults.dismissed;
    this.session.vulnerabilities = triageResults.confirmed;

    this.logger.warn(
      `${triageResults.dismissed.length} dismissed, ${triageResults.confirmed.length} confirmed`
    );

    if (triageResults.confirmed.length > 0) {
      this.logger.section('Confirmed Vulnerabilities');
      triageResults.confirmed.forEach((vuln, i) => {
        console.log(
          `${i + 1}. [${vuln.severity}] ${vuln.type}\n   ${vuln.file}:${vuln.line}\n   ${vuln.message}`
        );
      });
    }

    if (ai) {
      ai.printUsage();
    }
  }

  async fix(): Promise<void> {
    this.logger.section('SORK Remediation');

    if (this.session.vulnerabilities.length === 0) {
      // Allow `sork fix` without prior scan: scan now.
      await this.scan();
      if (this.session.vulnerabilities.length === 0) {
        return;
      }
    }

    const ai = await this.getAI();
    const remediation = new RemediationAgent(this.logger, ai, this.projectPath);
    const keeper = new KeeperAgent(this.logger, this.scanner, this.projectPath);

    const fixes = await remediation.generateFixes(this.session.vulnerabilities);
    this.session.fixes = fixes;

    const rangeByFix = new Map(
      fixes.map((f) => {
        const matchingVuln = this.session.vulnerabilities.find(
          (v: Vulnerability) => v.file === f.file && v.line === f.line && v.type === f.type
        );
        return [f, matchingVuln?.range] as const;
      })
    );

    await this.fixer.applyMultipleFixes(fixes.map((fix) => ({ fix, range: rangeByFix.get(fix) })));

    this.logger.section('SORK Verification');
    const verification = await keeper.verify(fixes, this.session.vulnerabilities);
    this.session.verified = verification.verified;
    keeper.printSummary(verification);

    if (ai) {
      ai.printUsage();
    }
  }

  async preCommit(): Promise<boolean> {
    this.logger.section('Pre-Commit Security Check');

    const stagedVulns = await this.scanner.scanStaged();
    if (stagedVulns.length === 0) {
      this.logger.success('No issues in staged changes. Safe to commit.');
      return true;
    }

    this.logger.error(`${stagedVulns.length} issue(s) in staged changes:`);
    stagedVulns.forEach((v, i) => {
      console.log(`  ${i + 1}. [${v.severity}] ${v.type} - ${v.file}:${v.line} - ${v.message}`);
    });

    const critical = stagedVulns.filter((v) => v.severity === 'CRITICAL');
    if (critical.length > 0) {
      this.logger.error('\nCRITICAL issues detected. Commit blocked.');
      console.log('Run `sork fix` to auto-resolve, then try again.');
      process.exit(1);
    }

    return false;
  }

  async setupHooks(): Promise<void> {
    this.logger.section('Setting Up Git Hooks');

    const hookContent = `#!/bin/sh
# Installed by SORK
sork pre-commit
status=$?
if [ $status -ne 0 ]; then
  echo "Pre-commit checks failed. Commit aborted."
  exit 1
fi
exit 0
`;

    const hooksDir = path.join(this.projectPath, '.git', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(path.join(hooksDir, 'pre-commit'), hookContent, { mode: 0o755 });
    this.logger.success('Pre-commit hook installed at .git/hooks/pre-commit');
  }

  async status(): Promise<void> {
    this.logger.section('SORK Status');

    const ai = await this.getAI();

    const config = await (await import('./config/index.js')).resolveAIConfig();
    const mode = !ai
      ? 'fallback (no API key)'
      : !config && (process.env.COHERE_API_KEY || process.env.SORK_COHERE_API_KEY)
        ? 'Cohere fallback'
        : config?.apiKey.startsWith('sork_live_')
          ? process.env.COHERE_API_KEY || process.env.SORK_COHERE_API_KEY
            ? 'SORK Cloud (managed) + Cohere fallback'
            : 'SORK Cloud (managed)'
          : process.env.COHERE_API_KEY || process.env.SORK_COHERE_API_KEY
            ? 'BYOK direct + Cohere fallback'
            : 'BYOK direct';
    console.log('Agents:');
    console.log(`  ✓ Agent 01 (TRIAGE)      ${mode}`);
    console.log(`  ✓ Agent 02 (REMEDIATION) ${mode}`);
    console.log('  ✓ Agent 03 (KEEPER)      Re-scan + audit log');
    console.log();

    try {
      const config = JSON.parse(
        await fs.readFile(path.join(this.projectPath, '.sorkrc.json'), 'utf-8')
      ) as SorkConfig;
      console.log('Project config:');
      console.log(`  Version:      ${config.version}`);
      console.log(`  Initialized:  ${config.initialized}`);
      console.log(`  Auto-fix:     ${config.settings.autoFix ? 'on' : 'off'}`);
      console.log(`  Pre-commit:   ${config.settings.preCommitGuards ? 'on' : 'off'}`);
    } catch {
      console.log('Project config: not initialized. Run `sork init`.');
    }

    console.log();
    console.log('Commands:');
    console.log('  sork config set-key <YOUR_API_KEY>           Configure AI key');
    console.log('  sork scan                                    Run security scan');
    console.log('  sork fix                                     Generate + apply fixes');
    console.log('  sork pre-commit                              Run pre-commit checks');
    console.log('  sork setup-hooks                             Install git hook');
  }
}
