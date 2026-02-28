/**
 * SORK Type Definitions
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Vulnerability {
  type: VulnerabilityType;
  file: string;
  line: number;
  column?: number;
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
  action: 'FIXED' | 'FAILED' | 'REGRESSION' | 'SCANNED' | 'DISMISSED';
  type: VulnerabilityType | string;
  file: string;
  details?: string;
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
  model?: 'anthropic' | 'local';
  debug?: boolean;
}

export interface ScannerOptions {
  excludePaths?: string[];
  includeTypes?: VulnerabilityType[];
}
