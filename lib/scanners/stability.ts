/**
 * SORK Stability Checker
 * Catches "torn code" — AI-generated or rushed code that looks syntactically
 * valid but will fail at runtime or in production.
 *
 * Designed to catch mistakes from both interns and AI code generation.
 */

import type { Language } from './languages.js';

export type StabilityCategory =
  | 'torn_code' // incomplete / stub / placeholder
  | 'null_crash' // will crash with null/undefined
  | 'ai_artifact' // classic AI generation mistakes
  | 'debug_leak' // debug code left in
  | 'error_swallow' // errors silently ignored
  | 'type_unsafe' // bypasses type system
  | 'async_trap' // async/await misuse
  | 'dep_injection' // bad dependency patterns
  | 'memory_leak'; // resource not released

export interface StabilityIssue {
  id: string;
  category: StabilityCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  line: number;
  col: number;
  snippet: string;
  message: string;
  plain: string; // intern-friendly plain English explanation
  fixHint: string;
  aiGenerated: boolean; // likely produced by AI code gen
}

interface StabilityPattern {
  id: string;
  category: StabilityCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  regex: RegExp;
  langs?: Language[];
  message: string;
  plain: string;
  fixHint: string;
  aiGenerated: boolean;
}

const STABILITY_PATTERNS: StabilityPattern[] = [
  // ── Torn / Stub code ────────────────────────────────────────────────────
  {
    id: 'ST001',
    category: 'torn_code',
    severity: 'CRITICAL',
    regex:
      /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented['"`]\s*\)|raise\s+NotImplementedError\s*\(\s*\)/i,
    message: 'Unimplemented function stub will crash in production.',
    plain:
      'This function was never actually written — it just throws an error saying "not implemented". If any code path reaches this, the app will crash.',
    fixHint: 'Implement the function body or add a feature flag: if (!featureEnabled) return null;',
    aiGenerated: true,
  },
  {
    id: 'ST002',
    category: 'torn_code',
    severity: 'HIGH',
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|NOTE:\s*remove|TEMP|placeholder|stub|incomplete)/i,
    message: 'Unresolved TODO/FIXME marker — incomplete code shipped to production.',
    plain:
      "A developer (or AI) left a reminder that this code isn't done yet. It might work now but break under certain conditions.",
    fixHint: "Resolve before merging. If it's a tracked issue, reference it: // TODO(#42)",
    aiGenerated: false,
  },
  {
    id: 'ST003',
    category: 'torn_code',
    severity: 'HIGH',
    regex: /return\s+(null|undefined|None|nil)\s*;\s*\/\/\s*(TODO|placeholder|implement|stub)/i,
    message: 'Function returns null as a placeholder — real logic not implemented.',
    plain:
      'This function pretends to work but always returns null/undefined. Any caller that uses this value will silently break.',
    fixHint: 'Implement the actual return value or throw a clear error if not ready.',
    aiGenerated: true,
  },
  {
    id: 'ST004',
    category: 'torn_code',
    severity: 'MEDIUM',
    regex: /pass\s*#|pass\s*$/m,
    langs: ['python'],
    message: 'Python `pass` as the only statement in a non-empty function.',
    plain:
      "This Python function does nothing. If it's meant to do something, the logic is missing.",
    fixHint: 'Add implementation or raise NotImplementedError with a clear message.',
    aiGenerated: false,
  },

  // ── AI Artifacts ─────────────────────────────────────────────────────────
  {
    id: 'AI001',
    category: 'ai_artifact',
    severity: 'HIGH',
    regex:
      /\/\/\s*(In a real app|In production|For demo|This is just an example|Normally you would)/i,
    message: 'AI-generated demo comment — code may not be production-ready.',
    plain:
      'This comment is a telltale sign that AI wrote this code as an example, not as real production code. The actual logic might be a shortcut.',
    fixHint: 'Review the surrounding code carefully — replace demo logic with real implementation.',
    aiGenerated: true,
  },
  {
    id: 'AI002',
    category: 'ai_artifact',
    severity: 'MEDIUM',
    regex: /\/\*\s*\.{3}\s*\*\/|\/\/\s*\.\.\.\s*rest of|\/\/\s*add more/i,
    message: 'Ellipsis placeholder — AI may have omitted important logic.',
    plain:
      'AI code generation sometimes uses "..." or "...rest of implementation" as a shortcut. Code after this may be missing or incomplete.',
    fixHint: 'Review what logic was supposed to go here and implement it.',
    aiGenerated: true,
  },
  {
    id: 'AI003',
    category: 'ai_artifact',
    severity: 'LOW',
    regex: /\/\/\s*Step \d+:|\/\/\s*\d+\./,
    message: 'Numbered step comments — typical AI code gen pattern, review for completeness.',
    plain:
      'AI models often break code into numbered steps. Check that all steps are actually implemented and none are missing.',
    fixHint: "Verify each numbered step has real logic and isn't just a comment.",
    aiGenerated: true,
  },

  // ── Null / Crash Safety ──────────────────────────────────────────────────
  {
    id: 'NC001',
    category: 'null_crash',
    severity: 'HIGH',
    langs: ['typescript', 'javascript'],
    regex: /\w+\[0\](?!\?)\s*\.\w+|\w+\.find\([^)]+\)(?!\?)\s*\.\w+/,
    message: 'Array access or .find() result used without null check — crashes on empty array.',
    plain:
      'If the array is empty or .find() returns undefined, the next dot-access will throw "Cannot read property of undefined". This is one of the most common crash causes.',
    fixHint:
      'Add optional chaining: arr.find(...)?.property or check: const item = arr.find(...); if (!item) return;',
    aiGenerated: false,
  },
  {
    id: 'NC002',
    category: 'null_crash',
    severity: 'HIGH',
    langs: ['typescript', 'javascript'],
    regex: /JSON\.parse\s*\([^)]+\)(?!\s*\?\.)(?!\s*&&)(?!.*try)/,
    message: 'JSON.parse() without try/catch — crashes on malformed input.',
    plain:
      "If the string isn't valid JSON, JSON.parse() throws an exception and the entire request/operation fails. This happens often with user-provided data.",
    fixHint: 'Wrap in try/catch: try { const data = JSON.parse(str); } catch { /* handle */ }',
    aiGenerated: false,
  },
  {
    id: 'NC003',
    category: 'null_crash',
    severity: 'MEDIUM',
    langs: ['typescript', 'javascript'],
    regex: /req\.(body|params|query)\.\w+(?!\?)\s*[^=!<>]/,
    message: 'Express/Hono request property accessed without validation.',
    plain:
      'HTTP request body/params/query fields are user-controlled and may be undefined, null, or a wrong type. Accessing them directly without validation can crash or cause security issues.',
    fixHint: 'Validate with Zod: const { id } = z.object({ id: z.string() }).parse(req.params)',
    aiGenerated: false,
  },

  // ── Async Traps ──────────────────────────────────────────────────────────
  {
    id: 'AS001',
    category: 'async_trap',
    severity: 'HIGH',
    langs: ['typescript', 'javascript'],
    regex: /async\s+function[^{]+\{(?:[^{}]|\{[^{}]*\})*\bawait\b(?:[^{}]|\{[^{}]*\})*\}/,
    message: '', // used only if no try/catch detected
    plain:
      'Async function with await but no error handling — unhandled promise rejection will crash Node.js.',
    fixHint: 'Wrap await calls in try/catch or add a .catch() handler on the outer Promise.',
    aiGenerated: false,
  },
  {
    id: 'AS002',
    category: 'async_trap',
    severity: 'MEDIUM',
    langs: ['typescript', 'javascript'],
    regex: /Promise\.all\s*\(\s*\[[^\]]*\]\s*\)(?!\s*\.catch)/,
    message: 'Promise.all() without .catch() — one rejection fails all.',
    plain:
      'If any one of the promises in Promise.all() rejects, the whole thing fails. Without .catch(), this becomes an unhandled rejection.',
    fixHint: 'Add error handling: Promise.all([...]).catch(err => ...) or use Promise.allSettled()',
    aiGenerated: false,
  },

  // ── Error Swallowing ─────────────────────────────────────────────────────
  {
    id: 'ES001',
    category: 'error_swallow',
    severity: 'HIGH',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}|except\s+\w*\s*:\s*\n\s*pass/,
    message: 'Empty catch/except block silently swallows errors.',
    plain:
      'When an error happens here, nothing will tell you about it. The app will continue as if nothing went wrong, making bugs nearly impossible to debug.',
    fixHint: 'At minimum log the error: catch (e) { console.error("[SORK]", e); }',
    aiGenerated: false,
  },
  {
    id: 'ES002',
    category: 'error_swallow',
    severity: 'MEDIUM',
    langs: ['typescript', 'javascript'],
    regex: /catch\s*\([^)]*\)\s*\{\s*\/\/[^\n]*\n\s*\}/,
    message: 'Catch block with only a comment — error silently swallowed.',
    plain:
      'The error is caught but only a comment is inside the handler. The actual error is never logged or handled.',
    fixHint: 'Add real error handling: logger.error("Operation failed", { error: e, context })',
    aiGenerated: false,
  },

  // ── Memory / Resource Leaks ──────────────────────────────────────────────
  {
    id: 'ML001',
    category: 'memory_leak',
    severity: 'MEDIUM',
    langs: ['typescript', 'javascript'],
    regex: /setInterval\s*\([^)]+\)(?![^{}]*clearInterval)/,
    message: 'setInterval() without clearInterval() — memory/resource leak.',
    plain:
      "setInterval creates a timer that runs forever. If the component or module is destroyed but the interval isn't cleared, it keeps running and leaking memory.",
    fixHint: 'Store the interval ID and call clearInterval(id) on cleanup/unmount.',
    aiGenerated: false,
  },
  {
    id: 'ML002',
    category: 'memory_leak',
    severity: 'HIGH',
    langs: ['typescript', 'javascript'],
    regex: /addEventListener\s*\([^)]+\)(?![^{}]*removeEventListener)/,
    message: 'addEventListener without removeEventListener — potential memory leak.',
    plain:
      'Event listeners that are never removed keep a reference to the function and the DOM element, preventing garbage collection.',
    fixHint: 'Return a cleanup function that calls removeEventListener, or use AbortController.',
    aiGenerated: false,
  },
];

export function runStabilityChecks(
  source: string,
  lang: Language,
  _filePath: string
): StabilityIssue[] {
  const lines = source.split('\n');
  const issues: StabilityIssue[] = [];

  for (const pattern of STABILITY_PATTERNS) {
    if (pattern.langs && !pattern.langs.includes(lang)) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Respect // sork-ignore or // sork-ignore-next-line
      if (/\/\/\s*sork-ignore/.test(line)) continue;
      if (i > 0 && /\/\/\s*sork-ignore-next-line/.test(lines[i - 1]!)) continue;

      const match = pattern.regex.exec(line);
      if (match) {
        issues.push({
          id: pattern.id,
          category: pattern.category,
          severity: pattern.severity,
          line: i + 1,
          col: match.index + 1,
          snippet: line.trim().slice(0, 120),
          message: pattern.message || `${pattern.category} issue detected`,
          plain: pattern.plain,
          fixHint: pattern.fixHint,
          aiGenerated: pattern.aiGenerated,
        });
      }
    }
  }

  return issues;
}

export function formatStabilityReport(issues: StabilityIssue[], filePath: string): string {
  if (issues.length === 0) return '';

  const lines: string[] = [`\n  Stability: ${filePath}`];
  const byCategory = new Map<string, StabilityIssue[]>();

  for (const issue of issues) {
    const group = byCategory.get(issue.category) ?? [];
    group.push(issue);
    byCategory.set(issue.category, group);
  }

  for (const [cat, catIssues] of byCategory) {
    lines.push(`\n  [${cat.toUpperCase().replace('_', ' ')}]`);
    for (const issue of catIssues) {
      lines.push(`    Line ${issue.line}: ${issue.message}`);
      lines.push(`    → ${issue.plain}`);
      lines.push(`    Fix: ${issue.fixHint}`);
      if (issue.aiGenerated) lines.push(`    ⚡ Likely AI-generated code — review carefully`);
    }
  }

  return lines.join('\n');
}
