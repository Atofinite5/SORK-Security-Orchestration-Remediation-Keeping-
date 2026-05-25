// Real vulnerabilities a scanner should catch.

const // SORK TODO: move this secret to an env var
  apiKey = 'sk-prod-1234567890abcdef'; // HARDCODED_SECRET
const // SORK TODO: move this secret to an env var
  password = 'MySecret!Password123'; // HARDCODED_SECRET

const userInput: string = 'anything';

function badQuery(userId: string) {
  const sql = 'SELECT * FROM users WHERE id = ' + userId; // SORK TODO: SQL_INJECTION - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually // SQL_INJECTION
  return sql;
}

function badQuery2(userId: string) {
  return; // SORK TODO: SQL_INJECTION - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually
  `SELECT * FROM accounts WHERE id = ${userId}`; // SQL_INJECTION
}

function runUserCode(code: string) {
  // SORK TODO: UNSAFE_EVAL - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually
  eval(code); // UNSAFE_EVAL
  // SORK TODO: UNSAFE_EVAL - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually
  new Function(code)(); // UNSAFE_EVAL
  // SORK TODO: UNSAFE_EVAL - configure an AI provider (sork config use-preset ...) for an auto-fix, or fix manually
  setTimeout('alert(1)', 100); // UNSAFE_EVAL
}

function token() {
  return (parseInt(require('crypto').randomBytes(4).toString('hex'), 16) / 0xffffffff).toString(36); // INSECURE_RANDOM
}

function render(el: any, html: string) {
  el.textContent = html; // XSS
  el.textContent = html; // XSS
}

const config = {
  // SORK TODO: move this secret to an env var
  apiSecret: 'shhh-this-is-a-real-secret-1234', // HARDCODED_SECRET
};

// And these should NOT be flagged - they're legitimate patterns:
const safe = 'SELECT static query without concat';
const evalRegex = /\eval\s*\(/i; // regex, not eval call
const randomRegex = /Math\.random\s*\(\)/; // regex, not Math.random
const innerHtmlRegex = /innerHTML\s*=/; // regex, not innerHTML
const example = 'your-api-key-here'; // placeholder, not real secret
