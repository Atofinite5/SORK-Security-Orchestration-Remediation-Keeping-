import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';

/**
 * Supported AI model providers for agent initialization
 */
export type AgentModel = 'claude' | 'openai' | 'codex' | 'gemini' | 'mistral' | 'llama';

export interface NAgentConfig {
  name: string;
  model: string;
  provider: string;
  baseURL: string;
  apiKey?: string;
  capabilities: string[];
  initialized: string;
}

/**
 * Mapping of agent models to their configurations
 */
const AGENT_CONFIGS: Record<AgentModel, Omit<NAgentConfig, 'name' | 'initialized'>> = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    capabilities: ['reasoning', 'code-analysis', 'security-audit', 'general-assistant'],
  },
  openai: {
    model: 'gpt-4o',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    capabilities: ['code-generation', 'reasoning', 'function-calling', 'general-assistant'],
  },
  codex: {
    model: 'codex-3',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    capabilities: ['code-completion', 'refactoring', 'bug-fixing', 'code-review'],
  },
  gemini: {
    model: 'gemini-2.0-pro',
    provider: 'google',
    baseURL: 'https://generativelanguage.googleapis.com/v1',
    capabilities: ['multimodal', 'reasoning', 'code-generation', 'general-assistant'],
  },
  mistral: {
    model: 'mistral-large-latest',
    provider: 'mistralai',
    baseURL: 'https://api.mistral.ai/v1',
    capabilities: ['code-generation', 'reasoning', 'general-assistant'],
  },
  llama: {
    model: 'Llama-4-Maverick-17B',
    provider: 'meta',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    capabilities: ['code-generation', 'reasoning', 'open-source', 'general-assistant'],
  },
};

/**
 * NAgentManager - Manages creation and configuration of multiple AI agents
 * Each agent is configured for a specific AI model provider
 */
export class NAgentManager {
  private logger: Logger;
  private projectPath: string;
  private agentsDir = '.sork/agents';

  constructor(logger: Logger, projectPath: string) {
    this.logger = logger;
    this.projectPath = projectPath;
  }

  /**
   * Parse agent name from command (e.g., "claude" from "init-claude-agent")
   */
  parseAgentName(command: string): string | null {
    const match = command.match(/^init-(.+)-agent$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Get the canonical agent model type from a name
   */
  getAgentModel(name: string): AgentModel | null {
    const normalized = name.toLowerCase() as AgentModel;
    return AGENT_CONFIGS[normalized] ? normalized : null;
  }

  /**
   * Get list of supported agent types
   */
  getSupportedAgents(): string[] {
    return Object.keys(AGENT_CONFIGS);
  }

  /**
   * Initialize a new AI agent for the specified model
   */
  async initializeAgent(modelName: string): Promise<NAgentConfig | null> {
    const agentModel = this.getAgentModel(modelName);
    if (!agentModel) {
      this.logger.error(`Unknown agent model: ${modelName}`);
      this.logger.info(`Supported models: ${this.getSupportedAgents().join(', ')}`);
      return null;
    }

    const agentConfig = AGENT_CONFIGS[agentModel];
    const fullConfig: NAgentConfig = {
      name: `${agentModel}-agent`,
      model: agentConfig.model,
      provider: agentConfig.provider,
      baseURL: agentConfig.baseURL,
      capabilities: agentConfig.capabilities,
      initialized: new Date().toISOString(),
    };

    // Create agents directory
    const agentsPath = path.join(this.projectPath, this.agentsDir);
    await fs.mkdir(agentsPath, { recursive: true });

    // Save agent configuration
    const configFile = path.join(agentsPath, `${agentModel}-agent.json`);
    await fs.writeFile(configFile, JSON.stringify(fullConfig, null, 2));

    this.logger.success(`${agentModel}-agent initialized!`);
    return fullConfig;
  }

  /**
   * List all initialized agents in the project
   */
  async listAgents(): Promise<NAgentConfig[]> {
    const agents: NAgentConfig[] = [];
    const agentsPath = path.join(this.projectPath, this.agentsDir);

    try {
      const files = await fs.readdir(agentsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(agentsPath, file), 'utf-8');
            agents.push(JSON.parse(content));
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return agents;
  }

  /**
   * Get a specific agent configuration
   */
  async getAgent(name: string): Promise<NAgentConfig | null> {
    const agentsPath = path.join(this.projectPath, this.agentsDir, `${name}-agent.json`);
    try {
      const content = await fs.readFile(agentsPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Delete an agent configuration
   */
  async deleteAgent(name: string): Promise<boolean> {
    const agentsPath = path.join(this.projectPath, this.agentsDir, `${name}-agent.json`);
    try {
      await fs.unlink(agentsPath);
      this.logger.success(`${name}-agent removed`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Print agent information
   */
  printAgentInfo(config: NAgentConfig): void {
    console.log(`\n${chalk.bold.cyan(`🤖 ${config.name}`)}`);
    console.log(`  Provider:     ${config.provider}`);
    console.log(`  Model:         ${config.model}`);
    console.log(`  Base URL:      ${config.baseURL}`);
    console.log(`  Initialized:   ${config.initialized}`);
    console.log(`  Capabilities:`);
    config.capabilities.forEach((cap) => {
      console.log(`    • ${cap}`);
    });
  }
}

// Re-export chalk for colored output
import chalk from 'chalk';
