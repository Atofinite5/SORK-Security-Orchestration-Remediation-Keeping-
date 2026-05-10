// Real vulnerabilities a scanner should catch.

const apiKey = 'sk-prod-1234567890abcdef'; // HARDCODED_SECRET
const password = 'MySecret!Password123'; // HARDCODED_SECRET

const userInput: string = 'anything';

function badQuery(userId: string) {
  const sql = 'SELECT * FROM users WHERE id = ' + userId; // SQL_INJECTION
  return sql;
}

function badQuery2(userId: string) {
  return `SELECT * FROM accounts WHERE id = ${userId}`; // SQL_INJECTION
}

function runUserCode(code: string) {
  eval(code); // UNSAFE_EVAL
  new Function(code)(); // UNSAFE_EVAL
  setTimeout('alert(1)', 100); // UNSAFE_EVAL
}

function token() {
  return Math.random().toString(36); // INSECURE_RANDOM
}

function render(el: any, html: string) {
  el.innerHTML = html; // XSS
  el.outerHTML = html; // XSS
}

const config = {
  apiSecret: 'shhh-this-is-a-real-secret-1234', // HARDCODED_SECRET
};

// And these should NOT be flagged - they're legitimate patterns:
const safe = 'SELECT static query without concat';
const evalRegex = /\beval\s*\(/i; // regex, not eval call
const randomRegex = /Math\.random\s*\(\)/; // regex, not Math.random
const innerHtmlRegex = /innerHTML\s*=/; // regex, not innerHTML
const example = 'your-api-key-here'; // placeholder, not real secret
