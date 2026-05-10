/**
 * SORK Type Definitions
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Vulnerability {
  type: VulnerabilityType;
  file: string;
  line: number;
  endLine?: number;
  column?: number;
  endColumn?: number;
  /** Character offsets [start, end) into the file. Used by the range-based fixer. */
  range?: [number, number];
  message: string;
  code?: string;
  severity: SeverityLevel;
  cveId?: string;
  dismissedReason?: string;
}

export type VulnerabilityType =
  | 'SQL_INJECTION'
  | 'XSS'
  | 'HARDCODED_SECRET'
  | 'INSECURE_RANDOM'
  | 'MISSING_VALIDATION'
  | 'PATH_TRAVERSAL'
  | 'UNSAFE_EVAL'
  | 'CSRF'
  | 'DEPENDENCY_VULN';

export interface CodeFix {
  type: VulnerabilityType;
  file: string;
  line: number;
  description: string;
  oldCode: string;
  newCode: string;
  priority: SeverityLevel;
}

export interface TriageResult {
  dismissed: Vulnerability[];
  confirmed: Vulnerability[];
}

export interface VerificationResult {
  verified: CodeFix[];
  failed: Array<{ fix: CodeFix; reason: string }>;
  regressions: Vulnerability[];
}

export interface AuditLogEntry {
  timestamp: string;
  action:
    | 'FIXED'
    | 'FAILED'
    | 'REGRESSION'
    | 'SCANNED'
    | 'DISMISSED'
    | 'COHERE_USED'
    | 'COHERE_FALLBACK';
  type: VulnerabilityType | string;
  file: string;
  details?: string;
  /** AI provider used for the action (e.g., 'minimax-m2.7', 'cohere') */
  provider?: string;
  /** Token usage for AI calls */
  tokens?: number;
}

export interface SorkSession {
  timestamp: Date;
  vulnerabilities: Vulnerability[];
  fixes: CodeFix[];
  dismissed: Vulnerability[];
  verified: CodeFix[];
}

export interface SorkConfig {
  version: string;
  initialized: string;
  agents: {
    triage: boolean;
    remediation: boolean;
    keeper: boolean;
  };
  settings: {
    autoFix: boolean;
    preCommitGuards: boolean;
    strictMode: boolean;
  };
}

export interface SorkOptions {
  projectPath?: string;
  debug?: boolean;
}

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SorkUserConfig {
  ai?: AIProviderConfig;
}

export interface ScannerOptions {
  excludePaths?: string[];
  includeTypes?: VulnerabilityType[];
}
