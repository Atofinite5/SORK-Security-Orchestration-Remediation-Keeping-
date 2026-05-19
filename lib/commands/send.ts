import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import chalk from 'chalk';
import { resolveAIConfig, KEY_SIGNUP_URL } from '../config/index.js';

const DASHBOARD_URL = 'https://sorkcloud.space/dashboard';
const MAX_FILE_BYTES = 80_000;

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

export async function sendToCloud(filePath?: string): Promise<void> {
  const ai = await resolveAIConfig();
  const apiKey = ai?.apiKey;

  if (!filePath) {
    // No file — just open the dashboard
    const url = apiKey ? `${DASHBOARD_URL}?key=${encodeURIComponent(apiKey)}` : DASHBOARD_URL;
    openBrowser(url);
    console.log(chalk.cyan('→') + ' Opening SORK Cloud dashboard...');
    console.log(chalk.dim('  ' + url));
    return;
  }

  const resolvedPath = path.resolve(filePath);
  let content: string;

  try {
    const raw = await fs.readFile(resolvedPath);
    if (raw.length > MAX_FILE_BYTES) {
      console.log(chalk.yellow(`⚠  File is large (${(raw.length / 1024).toFixed(1)}KB), truncating to 80KB`));
    }
    content = raw.slice(0, MAX_FILE_BYTES).toString('utf-8');
  } catch {
    throw new Error(`Cannot read file: ${resolvedPath}`);
  }

  const fileName = path.basename(resolvedPath);
  const params = new URLSearchParams({
    file: fileName,
    code: Buffer.from(content).toString('base64'),
  });
  if (apiKey) {
    params.set('key', apiKey);
  }

  const url = `${DASHBOARD_URL}?${params.toString()}`;

  openBrowser(url);

  console.log(chalk.green('✓') + ` Sending ${chalk.cyan(fileName)} to SORK Cloud...`);
  console.log(chalk.dim(`  ${fileName} (${(content.length / 1024).toFixed(1)}KB)`));
  if (!apiKey) {
    console.log('');
    console.log(chalk.yellow('  No API key found. Set one first:'));
    console.log('  ' + chalk.cyan(`sork config set-key <YOUR_KEY>`));
    console.log(chalk.dim(`  Get a key at: ${KEY_SIGNUP_URL}`));
  } else {
    console.log(chalk.dim('  Dashboard will auto-fill the chat with your file.'));
  }
}

export async function sendFolderToCloud(folderPath: string): Promise<void> {
  const resolvedPath = path.resolve(folderPath);
  const SUPPORTED = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php', '.vue', '.svelte']);

  async function collect(dir: string, files: Array<{ name: string; content: string }> = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collect(full, files);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED.has(ext)) {
          try {
            const raw = await fs.readFile(full);
            if (raw.length < 50_000) {
              files.push({ name: path.relative(resolvedPath, full), content: raw.toString('utf-8') });
            }
          } catch { /* skip unreadable */ }
        }
      }
    }
    return files;
  }

  const files = await collect(resolvedPath);
  if (files.length === 0) {
    throw new Error(`No supported source files found in ${folderPath}`);
  }

  const ai = await resolveAIConfig();
  const combined = files.map((f) => `// === ${f.name} ===\n${f.content}`).join('\n\n');
  const params = new URLSearchParams({
    file: `#${path.basename(resolvedPath)}/ (${files.length} files)`,
    code: Buffer.from(combined.slice(0, MAX_FILE_BYTES)).toString('base64'),
  });
  if (ai?.apiKey) params.set('key', ai.apiKey);

  openBrowser(`${DASHBOARD_URL}?${params.toString()}`);

  console.log(chalk.green('✓') + ` Sending ${chalk.cyan('#' + path.basename(resolvedPath))} (${files.length} files) to SORK Cloud...`);
  files.slice(0, 8).forEach((f) => console.log(chalk.dim(`    @${f.name}`)));
  if (files.length > 8) console.log(chalk.dim(`    ... and ${files.length - 8} more`));
}
