/**
 * SORK Language-Aware Pattern Scanner
 * Supports: TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, Ruby, PHP
 * Each language has its own vulnerability pattern library.
 */

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'c'
  | 'cpp'
  | 'ruby'
  | 'php'
  | 'unknown';

export interface LangPattern {
  id: string;
  name: string;
  regex: RegExp;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category:
    | 'injection'
    | 'secrets'
    | 'nullsafe'
    | 'crypto'
    | 'auth'
    | 'logic'
    | 'stability'
    | 'debug';
  message: string;
  fixHint: string;
  cwe?: string;
}

export function detectLanguage(filePath: string): Language {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, Language> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    pyw: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    rb: 'ruby',
    php: 'php',
  };
  return map[ext] ?? 'unknown';
}

// ── TypeScript / JavaScript ────────────────────────────────────────────────
const TS_PATTERNS: LangPattern[] = [
  {
    id: 'TS001',
    name: 'SQL Injection',
    cwe: 'CWE-89',
    regex: /(`|"|').*SELECT.*WHERE.*\$\{|query\s*\(\s*[`"'].*\+\s*(req|user|params|body|query)/i,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'Possible SQL injection via string concatenation or template literal.',
    fixHint: 'Use parameterized queries: db.query("SELECT ... WHERE id = $1", [id])',
  },
  {
    id: 'TS002',
    name: 'XSS via innerHTML',
    cwe: 'CWE-79',
    regex: /\.innerHTML\s*=|dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html/,
    severity: 'HIGH',
    category: 'injection',
    message: 'Direct innerHTML assignment or dangerouslySetInnerHTML can lead to XSS.',
    fixHint: 'Use textContent or DOMPurify.sanitize() before setting innerHTML.',
  },
  {
    id: 'TS003',
    name: 'Hardcoded Secret',
    cwe: 'CWE-798',
    regex:
      /(api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*["'`][A-Za-z0-9+/=_-]{8,}/i,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Hardcoded credential detected in source code.',
    fixHint: 'Move to environment variables: process.env.SECRET_KEY',
  },
  {
    id: 'TS004',
    name: 'Unsafe eval()',
    cwe: 'CWE-95',
    regex: /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]/,
    severity: 'HIGH',
    category: 'injection',
    message: 'eval() or dynamic Function() is dangerous with user input.',
    fixHint: 'Replace with static logic or JSON.parse() for data parsing.',
  },
  {
    id: 'TS005',
    name: 'Null Dereference Risk',
    cwe: 'CWE-476',
    regex: /\.(map|filter|forEach|find|reduce)\s*\([^)]*\)\s*\.\w+(?!\?)/,
    severity: 'MEDIUM',
    category: 'nullsafe',
    message: 'Chained method call without null check — may throw if array is undefined.',
    fixHint: 'Add optional chaining: array?.map(...)',
  },
  {
    id: 'TS006',
    name: 'Unchecked any cast',
    cwe: 'CWE-704',
    regex: /as\s+any\b|:\s*any\b/,
    severity: 'LOW',
    category: 'nullsafe',
    message: 'TypeScript `any` cast bypasses type safety and may hide runtime errors.',
    fixHint: 'Use a specific type or `unknown` with a type guard.',
  },
  {
    id: 'TS007',
    name: 'Command Injection',
    cwe: 'CWE-78',
    regex: /exec\s*\(|execSync\s*\(|spawn\s*\([^,]*\+/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'Shell command with concatenated input — command injection risk.',
    fixHint: 'Use execFile() with args array, never concatenate user input into shell commands.',
  },
  {
    id: 'TS008',
    name: 'Prototype Pollution',
    cwe: 'CWE-1321',
    regex: /\[['"`]__proto__['"`]\]|\[['"`]constructor['"`]\]|\[['"`]prototype['"`]\]/,
    severity: 'HIGH',
    category: 'injection',
    message: 'Possible prototype pollution via dynamic key assignment.',
    fixHint: 'Validate keys with Object.keys() and block __proto__/constructor.',
  },
  {
    id: 'TS009',
    name: 'Insecure Random',
    cwe: 'CWE-338',
    regex: /Math\.random\s*\(\s*\)/,
    severity: 'MEDIUM',
    category: 'crypto',
    message: 'Math.random() is not cryptographically secure.',
    fixHint: 'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive values.',
  },
  {
    id: 'TS010',
    name: 'Debug Log Leak',
    cwe: 'CWE-117',
    regex: /console\.(log|warn|error|debug)\s*\([^)]*?(password|token|secret|key|auth)/i,
    severity: 'HIGH',
    category: 'debug',
    message: 'Sensitive data may be leaking via console output.',
    fixHint: 'Remove debug logs before deployment or use a structured logger with redaction.',
  },
];

// ── Python ─────────────────────────────────────────────────────────────────
const PY_PATTERNS: LangPattern[] = [
  {
    id: 'PY001',
    name: 'SQL Injection',
    cwe: 'CWE-89',
    regex: /execute\s*\(\s*["'f].*%(s|d)|execute\s*\(\s*f["'].*\{/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'Python SQL query built with string formatting — SQL injection risk.',
    fixHint: 'Use parameterized queries: cursor.execute("SELECT ... WHERE id = %s", (id,))',
  },
  {
    id: 'PY002',
    name: 'Hardcoded Secret',
    cwe: 'CWE-798',
    regex: /(api_key|secret|password|token)\s*=\s*["'][A-Za-z0-9+/=_-]{8,}/i,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Hardcoded credential in Python source.',
    fixHint: 'Use os.environ.get("SECRET_KEY") or python-dotenv.',
  },
  {
    id: 'PY003',
    name: 'Command Injection',
    cwe: 'CWE-78',
    regex: /os\.system\s*\(|subprocess\.call\s*\([^,]*\+|subprocess\.run\s*\([^,]*f['"]/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'Shell command with dynamic input — command injection risk.',
    fixHint: 'Use subprocess.run(["cmd", arg], shell=False) with a list of args.',
  },
  {
    id: 'PY004',
    name: 'Unsafe Pickle',
    cwe: 'CWE-502',
    regex: /pickle\.loads?\s*\(|cPickle\.loads?\s*\(/,
    severity: 'HIGH',
    category: 'injection',
    message: 'pickle.load() with untrusted data enables remote code execution.',
    fixHint: 'Use json.loads() or marshmallow for safe deserialization.',
  },
  {
    id: 'PY005',
    name: 'Path Traversal',
    cwe: 'CWE-22',
    regex: /open\s*\([^)]*\+|open\s*\(f["'][^)]*\{/,
    severity: 'HIGH',
    category: 'injection',
    message: 'File open with dynamic path may allow path traversal.',
    fixHint:
      'Use pathlib.Path(base_dir, user_input).resolve() and validate it stays within base_dir.',
  },
  {
    id: 'PY006',
    name: 'Assert in Production',
    cwe: 'CWE-617',
    regex: /^\s*assert\s+(?!isinstance|len|type)/m,
    severity: 'MEDIUM',
    category: 'stability',
    message: 'assert statements are disabled with python -O flag — not safe for validation.',
    fixHint: 'Replace with explicit if/raise: if not condition: raise ValueError("...")',
  },
  {
    id: 'PY007',
    name: 'Eval Injection',
    cwe: 'CWE-95',
    regex: /\beval\s*\(|exec\s*\(/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'eval()/exec() with dynamic input enables code injection.',
    fixHint: 'Eliminate eval(). Use ast.literal_eval() for safe expression parsing.',
  },
  {
    id: 'PY008',
    name: 'Bare Except',
    cwe: 'CWE-390',
    regex: /except\s*:/,
    severity: 'MEDIUM',
    category: 'stability',
    message: 'Bare `except:` catches all exceptions including KeyboardInterrupt and SystemExit.',
    fixHint: 'Catch specific exceptions: except (ValueError, TypeError) as e:',
  },
  {
    id: 'PY009',
    name: 'Debug Print Leak',
    cwe: 'CWE-117',
    regex: /print\s*\([^)]*?(password|token|secret|key|api)/i,
    severity: 'HIGH',
    category: 'debug',
    message: 'Sensitive data may be leaking via print().',
    fixHint: 'Remove debug prints or use logging with appropriate level and redaction.',
  },
  {
    id: 'PY010',
    name: 'Mutable Default Arg',
    cwe: 'CWE-1188',
    regex: /def\s+\w+\([^)]*=\s*(\[\]|\{\}|\(\))/,
    severity: 'LOW',
    category: 'logic',
    message: 'Mutable default argument is shared across all calls — classic Python gotcha.',
    fixHint: 'Use None as default and create new object inside the function.',
  },
];

// ── Rust ───────────────────────────────────────────────────────────────────
const RUST_PATTERNS: LangPattern[] = [
  {
    id: 'RS001',
    name: 'Unsafe Block',
    cwe: 'CWE-119',
    regex: /\bunsafe\s*\{/,
    severity: 'HIGH',
    category: 'stability',
    message: 'unsafe block bypasses Rust memory safety guarantees.',
    fixHint: 'Document why unsafe is necessary. Consider safe abstractions instead.',
  },
  {
    id: 'RS002',
    name: 'unwrap() on Result/Option',
    cwe: 'CWE-248',
    regex: /\.unwrap\s*\(\s*\)/,
    severity: 'HIGH',
    category: 'nullsafe',
    message: '.unwrap() panics at runtime if the value is Err or None.',
    fixHint: 'Use .expect("context") for debugging or .unwrap_or() / ? operator in production.',
  },
  {
    id: 'RS003',
    name: 'expect() without context',
    cwe: 'CWE-248',
    regex: /\.expect\s*\(\s*["']\s*["']\s*\)/,
    severity: 'MEDIUM',
    category: 'stability',
    message: '.expect("") with empty message gives no debug context on panic.',
    fixHint: 'Provide a meaningful message: .expect("Failed to open config file")',
  },
  {
    id: 'RS004',
    name: 'Hardcoded Secret',
    cwe: 'CWE-798',
    regex: /(api_key|secret|password|token)\s*=\s*["'][A-Za-z0-9+/=_-]{8,}/i,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Hardcoded credential in Rust source.',
    fixHint: 'Use std::env::var("SECRET_KEY") or the dotenvy crate.',
  },
  {
    id: 'RS005',
    name: 'SQL Injection (sqlx raw)',
    cwe: 'CWE-89',
    regex: /sqlx::query\s*\(\s*&?format!\s*\(/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'SQL query built with format!() macro — injection risk.',
    fixHint:
      'Use sqlx::query!() macro with bound parameters: query!("SELECT ... WHERE id = ?", id)',
  },
  {
    id: 'RS006',
    name: 'Integer Overflow Risk',
    cwe: 'CWE-190',
    regex: /as\s+u(8|16|32|64|size)|as\s+i(8|16|32)/,
    severity: 'LOW',
    category: 'logic',
    message: 'Numeric cast with `as` may silently truncate or wrap in release builds.',
    fixHint: 'Use .try_into() for checked casts that return Result.',
  },
];

// ── Go ─────────────────────────────────────────────────────────────────────
const GO_PATTERNS: LangPattern[] = [
  {
    id: 'GO001',
    name: 'SQL Injection',
    cwe: 'CWE-89',
    regex: /fmt\.Sprintf\s*\(.*SELECT.*WHERE|db\.(Query|Exec)\s*\(.*\+/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'SQL query assembled with fmt.Sprintf — injection risk.',
    fixHint: 'Use db.Query("SELECT ... WHERE id = ?", id) with placeholders.',
  },
  {
    id: 'GO002',
    name: 'Error Ignored',
    cwe: 'CWE-390',
    regex: /,\s*_\s*:?=\s*\w+\.(Open|Create|Write|Read|Connect|Exec|Query)\s*\(/,
    severity: 'HIGH',
    category: 'stability',
    message: 'Error return value discarded with _ — silent failure.',
    fixHint: 'Always handle errors: f, err := os.Open(...); if err != nil { ... }',
  },
  {
    id: 'GO003',
    name: 'Hardcoded Secret',
    cwe: 'CWE-798',
    regex: /(apiKey|secret|password|token)\s*:?=\s*["'][A-Za-z0-9+/=_-]{8,}/i,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Hardcoded credential in Go source.',
    fixHint: 'Use os.Getenv("SECRET_KEY") or the godotenv package.',
  },
  {
    id: 'GO004',
    name: 'Goroutine Leak Risk',
    cwe: 'CWE-404',
    regex: /go\s+func\s*\([^)]*\)\s*\{[^}]*for\s*\{/,
    severity: 'MEDIUM',
    category: 'logic',
    message: 'Goroutine with infinite loop — may leak if channel is never closed.',
    fixHint: 'Use context.Context with Done() channel: select { case <-ctx.Done(): return }',
  },
  {
    id: 'GO005',
    name: 'Race Condition (map)',
    cwe: 'CWE-362',
    regex: /map\[.*\]\s*\{[^}]*\}(?!.*sync\.)/,
    severity: 'MEDIUM',
    category: 'logic',
    message: 'Map used without mutex in concurrent code may cause race condition.',
    fixHint: 'Use sync.Map or protect with sync.RWMutex.',
  },
];

// ── Java ───────────────────────────────────────────────────────────────────
const JAVA_PATTERNS: LangPattern[] = [
  {
    id: 'JV001',
    name: 'SQL Injection',
    cwe: 'CWE-89',
    regex: /Statement\.execute\s*\(|createStatement\s*\(\s*\)[^;]*\+/,
    severity: 'CRITICAL',
    category: 'injection',
    message: 'SQL built with string concatenation — use PreparedStatement.',
    fixHint:
      'PreparedStatement ps = conn.prepareStatement("SELECT ... WHERE id = ?"); ps.setInt(1, id);',
  },
  {
    id: 'JV002',
    name: 'NullPointerException Risk',
    cwe: 'CWE-476',
    regex: /\w+\.\w+\s*\(\s*\)\.(\w+)/,
    severity: 'MEDIUM',
    category: 'nullsafe',
    message: 'Chained method calls without null check risk NullPointerException.',
    fixHint: 'Use Optional<T> or null-check each step: if (obj != null && obj.getValue() != null)',
  },
  {
    id: 'JV003',
    name: 'Hardcoded Secret',
    cwe: 'CWE-798',
    regex: /(apiKey|secret|password|token)\s*=\s*["'][A-Za-z0-9+/=_-]{8,}/i,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Hardcoded credential in Java source.',
    fixHint: 'Use System.getenv("SECRET_KEY") or a secrets manager.',
  },
  {
    id: 'JV004',
    name: 'Unsafe Deserialization',
    cwe: 'CWE-502',
    regex: /ObjectInputStream\s*\(|readObject\s*\(\s*\)/,
    severity: 'HIGH',
    category: 'injection',
    message: 'Java deserialization of untrusted data can enable RCE.',
    fixHint: 'Use Jackson/Gson with type constraints or whitelist-based ObjectInputFilter.',
  },
];

// ── Universal (any language) ───────────────────────────────────────────────
const UNIVERSAL_PATTERNS: LangPattern[] = [
  {
    id: 'UN001',
    name: 'TODO in Production Code',
    cwe: undefined,
    regex: /\/\/\s*TODO|#\s*TODO|\/\/\s*FIXME|#\s*FIXME|\/\/\s*HACK/i,
    severity: 'LOW',
    category: 'stability',
    message: 'Unresolved TODO/FIXME/HACK comment in production code.',
    fixHint: 'Resolve before merging or link to a tracked issue: // TODO(#123): ...',
  },
  {
    id: 'UN002',
    name: 'Placeholder / Stub Function',
    cwe: undefined,
    regex:
      /throw\s+new\s+Error\s*\(\s*["']not\s+implemented|raise\s+NotImplementedError|panic!\s*\(\s*["']not\s+implemented/i,
    severity: 'HIGH',
    category: 'stability',
    message: 'Unimplemented stub function will crash at runtime.',
    fixHint: 'Implement the function before shipping or add a feature flag guard.',
  },
  {
    id: 'UN003',
    name: 'Empty Catch Block',
    cwe: 'CWE-390',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}|except\s*[^:]*:\s*pass/,
    severity: 'HIGH',
    category: 'stability',
    message: 'Empty catch/except silently swallows errors — bugs become invisible.',
    fixHint: 'Log the error at minimum: catch (e) { logger.error(e); }',
  },
  {
    id: 'UN004',
    name: 'AWS/GCP/Azure Key Pattern',
    cwe: 'CWE-798',
    regex: /AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|[0-9a-f]{32}-us[0-9]{1,2}|sk-[A-Za-z0-9]{32,}/,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Cloud provider API key detected in source file.',
    fixHint: 'Rotate this key immediately and store in environment variables or a secrets manager.',
  },
  {
    id: 'UN005',
    name: 'Private Key Block',
    cwe: 'CWE-321',
    regex: /-----BEGIN\s+(RSA|EC|OPENSSH|DSA|PGP)\s+PRIVATE\s+KEY/,
    severity: 'CRITICAL',
    category: 'secrets',
    message: 'Private key embedded in source — critical credential exposure.',
    fixHint:
      'Remove immediately, rotate the key, use a secrets manager (Vault, AWS Secrets Manager).',
  },
];

// ── Registry ───────────────────────────────────────────────────────────────
const PATTERN_REGISTRY: Record<Language, LangPattern[]> = {
  typescript: [...TS_PATTERNS, ...UNIVERSAL_PATTERNS],
  javascript: [...TS_PATTERNS, ...UNIVERSAL_PATTERNS],
  python: [...PY_PATTERNS, ...UNIVERSAL_PATTERNS],
  rust: [...RUST_PATTERNS, ...UNIVERSAL_PATTERNS],
  go: [...GO_PATTERNS, ...UNIVERSAL_PATTERNS],
  java: [...JAVA_PATTERNS, ...UNIVERSAL_PATTERNS],
  c: [...UNIVERSAL_PATTERNS],
  cpp: [...UNIVERSAL_PATTERNS],
  ruby: [...UNIVERSAL_PATTERNS],
  php: [...UNIVERSAL_PATTERNS],
  unknown: [...UNIVERSAL_PATTERNS],
};

export interface LangMatch {
  patternId: string;
  name: string;
  line: number;
  col: number;
  snippet: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  fixHint: string;
  cwe?: string;
}

export function scanWithLanguagePatterns(source: string, lang: Language): LangMatch[] {
  const patterns = PATTERN_REGISTRY[lang] ?? UNIVERSAL_PATTERNS;
  const lines = source.split('\n');
  const matches: LangMatch[] = [];

  for (const pattern of patterns) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Respect // sork-ignore or // sork-ignore-next-line
      if (/\/\/\s*sork-ignore/.test(line)) continue;
      if (i > 0 && /\/\/\s*sork-ignore-next-line/.test(lines[i - 1]!)) continue;

      const match = pattern.regex.exec(line);
      if (match) {
        matches.push({
          patternId: pattern.id,
          name: pattern.name,
          line: i + 1,
          col: match.index + 1,
          snippet: line.trim().slice(0, 120),
          severity: pattern.severity,
          category: pattern.category,
          message: pattern.message,
          fixHint: pattern.fixHint,
          cwe: pattern.cwe,
        });
      }
    }
  }

  return matches;
}
