import { parse, AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree';
import { Vulnerability, VulnerabilityType, SeverityLevel } from '../types/index.js';

type Node = TSESTree.Node;

const SECRET_NAME =
  /^(api[_-]?key|api[_-]?secret|password|passwd|secret|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret)$/i;
const SQL_KEYWORDS =
  /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|UNION\s+SELECT)\b/i;

interface Finding {
  type: VulnerabilityType;
  message: string;
  severity: SeverityLevel;
  node: Node;
}

export function scanSource(source: string, file: string): Vulnerability[] {
  let ast: TSESTree.Program;
  try {
    ast = parse(source, {
      loc: true,
      range: true,
      jsx: file.endsWith('.tsx') || file.endsWith('.jsx'),
      comment: false,
      tokens: false,
      errorOnUnknownASTType: false,
    });
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  walk(ast, (node) => visitNode(node, findings));

  return findings.map((f) => toVulnerability(f, source, file));
}

function visitNode(node: Node, out: Finding[]): void {
  switch (node.type) {
    case AST_NODE_TYPES.CallExpression:
      checkEvalCall(node, out);
      checkMathRandom(node, out);
      checkSetTimeoutString(node, out);
      break;

    case AST_NODE_TYPES.NewExpression:
      checkNewFunction(node, out);
      break;

    case AST_NODE_TYPES.AssignmentExpression:
      checkInnerHTMLAssignment(node, out);
      break;

    case AST_NODE_TYPES.JSXAttribute:
      checkDangerouslySetInnerHTML(node, out);
      break;

    case AST_NODE_TYPES.VariableDeclarator:
      checkSecretVarDeclarator(node, out);
      break;

    case AST_NODE_TYPES.Property:
      checkSecretProperty(node, out);
      break;

    case AST_NODE_TYPES.TemplateLiteral:
      checkSqlTemplate(node, out);
      break;

    case AST_NODE_TYPES.BinaryExpression:
      checkSqlConcat(node, out);
      break;
  }
}

function checkEvalCall(node: TSESTree.CallExpression, out: Finding[]): void {
  if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'eval') {
    out.push({
      type: 'UNSAFE_EVAL',
      message: 'Use of eval() is dangerous - executes arbitrary code',
      severity: 'CRITICAL',
      node,
    });
  }
}

function checkMathRandom(node: TSESTree.CallExpression, out: Finding[]): void {
  const callee = node.callee;
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === 'Math' &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === 'random'
  ) {
    out.push({
      type: 'INSECURE_RANDOM',
      message: 'Math.random() is not cryptographically secure - use crypto.randomBytes',
      severity: 'HIGH',
      node,
    });
  }
}

function checkSetTimeoutString(node: TSESTree.CallExpression, out: Finding[]): void {
  if (
    node.callee.type === AST_NODE_TYPES.Identifier &&
    (node.callee.name === 'setTimeout' || node.callee.name === 'setInterval') &&
    node.arguments[0]?.type === AST_NODE_TYPES.Literal &&
    typeof node.arguments[0].value === 'string'
  ) {
    out.push({
      type: 'UNSAFE_EVAL',
      message: `${node.callee.name}() with string argument runs eval-equivalent code`,
      severity: 'HIGH',
      node,
    });
  }
}

function checkNewFunction(node: TSESTree.NewExpression, out: Finding[]): void {
  if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'Function') {
    out.push({
      type: 'UNSAFE_EVAL',
      message: 'new Function(...) executes arbitrary code from a string',
      severity: 'CRITICAL',
      node,
    });
  }
}

function checkInnerHTMLAssignment(node: TSESTree.AssignmentExpression, out: Finding[]): void {
  if (
    node.left.type === AST_NODE_TYPES.MemberExpression &&
    node.left.property.type === AST_NODE_TYPES.Identifier &&
    (node.left.property.name === 'innerHTML' || node.left.property.name === 'outerHTML')
  ) {
    out.push({
      type: 'XSS',
      message: `Assignment to ${node.left.property.name} - potential XSS, prefer textContent`,
      severity: 'HIGH',
      node,
    });
  }
}

function checkDangerouslySetInnerHTML(node: TSESTree.JSXAttribute, out: Finding[]): void {
  if (
    node.name.type === AST_NODE_TYPES.JSXIdentifier &&
    node.name.name === 'dangerouslySetInnerHTML'
  ) {
    out.push({
      type: 'XSS',
      message: 'dangerouslySetInnerHTML bypasses React XSS protection',
      severity: 'HIGH',
      node,
    });
  }
}

function checkSecretVarDeclarator(node: TSESTree.VariableDeclarator, out: Finding[]): void {
  if (
    node.id.type === AST_NODE_TYPES.Identifier &&
    SECRET_NAME.test(node.id.name) &&
    isSuspiciousSecretValue(node.init)
  ) {
    out.push({
      type: 'HARDCODED_SECRET',
      message: `Hardcoded secret in '${node.id.name}' - move to env var`,
      severity: 'CRITICAL',
      node,
    });
  }
}

function checkSecretProperty(node: TSESTree.Property, out: Finding[]): void {
  const keyName = getPropertyName(node.key);
  if (keyName && SECRET_NAME.test(keyName) && isSuspiciousSecretValue(node.value)) {
    out.push({
      type: 'HARDCODED_SECRET',
      message: `Hardcoded secret in '${keyName}' - move to env var`,
      severity: 'CRITICAL',
      node,
    });
  }
}

function checkSqlTemplate(node: TSESTree.TemplateLiteral, out: Finding[]): void {
  if (node.expressions.length === 0) {
    return;
  }
  const fullText = node.quasis.map((q: TSESTree.TemplateElement) => q.value.cooked).join('?');
  if (SQL_KEYWORDS.test(fullText)) {
    out.push({
      type: 'SQL_INJECTION',
      message: 'SQL string with interpolated values - use parameterized queries',
      severity: 'CRITICAL',
      node,
    });
  }
}

function checkSqlConcat(node: TSESTree.BinaryExpression, out: Finding[]): void {
  if (node.operator !== '+') {
    return;
  }
  const text = collectStringLiterals(node).join(' ');
  if (text && SQL_KEYWORDS.test(text) && hasNonLiteralOperand(node)) {
    out.push({
      type: 'SQL_INJECTION',
      message: 'SQL string concatenated with variable - use parameterized queries',
      severity: 'CRITICAL',
      node,
    });
  }
}

function isSuspiciousSecretValue(value: Node | null | undefined): boolean {
  if (!value) {
    return false;
  }
  if (value.type === AST_NODE_TYPES.Literal && typeof value.value === 'string') {
    const v = value.value;
    if (v.length < 8) {
      return false;
    }
    if (/^(your[_-]|example|placeholder|xxx|test|dummy|fake)/i.test(v)) {
      return false;
    }
    return true;
  }
  return false;
}

function getPropertyName(key: Node): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string') {
    return key.value;
  }
  return null;
}

function collectStringLiterals(node: Node): string[] {
  const result: string[] = [];
  walk(node, (n) => {
    if (n.type === AST_NODE_TYPES.Literal && typeof n.value === 'string') {
      result.push(n.value);
    }
  });
  return result;
}

function hasNonLiteralOperand(node: TSESTree.BinaryExpression): boolean {
  const isLit = (n: Node): boolean => n.type === AST_NODE_TYPES.Literal;
  return !isLit(node.left) || !isLit(node.right);
}

function toVulnerability(f: Finding, source: string, file: string): Vulnerability {
  const loc = f.node.loc!;
  const range = f.node.range!;
  const codeSnippet = source.slice(range[0], range[1]).split('\n')[0].slice(0, 200);
  return {
    type: f.type,
    file,
    line: loc.start.line,
    endLine: loc.end.line,
    column: loc.start.column,
    endColumn: loc.end.column,
    range: [range[0], range[1]],
    message: f.message,
    code: codeSnippet,
    severity: f.severity,
  };
}

/**
 * Recursive AST walker. Visits every node exactly once.
 * Skips entering RegExp literals, comments, and template-quasis (already handled at parent level).
 */
function walk(root: Node, visit: (node: Node) => void): void {
  const stack: Node[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    visit(node);
    for (const child of childrenOf(node)) {
      if (child) {
        stack.push(child);
      }
    }
  }
}

function childrenOf(node: Node): Node[] {
  const children: Node[] = [];
  for (const key of Object.keys(node) as (keyof Node)[]) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue;
    }
    const value = (node as unknown as Record<string, unknown>)[key as string];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          children.push(item);
        }
      }
    } else if (isNode(value)) {
      children.push(value as Node);
    }
  }
  return children;
}

function isNode(value: unknown): value is Node {
  return !!value && typeof value === 'object' && 'type' in (value as object);
}
