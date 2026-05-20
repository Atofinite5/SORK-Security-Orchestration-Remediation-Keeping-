import { watch } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { detectLanguage, scanWithLanguagePatterns } from '../scanners/languages.js';
import { runStabilityChecks } from '../scanners/stability.js';
import { c, sevBadge, rule } from '../utils/palette.js';

const WATCHABLE = new Set(['.ts','.tsx','.js','.jsx','.mjs','.py','.rs','.go','.java','.rb','.php','.c','.cpp','.h','.cs']);
const IGNORE    = new Set(['node_modules','.git','dist','build','.next','target','__pycache__']);

function shouldWatch(p: string): boolean {
  return WATCHABLE.has(path.extname(p).toLowerCase()) &&
    !p.split(path.sep).some(s => IGNORE.has(s));
}

async function scanFile(filePath: string): Promise<void> {
  try {
    const source    = await fs.readFile(filePath, 'utf-8');
    const lang      = detectLanguage(filePath);
    const rel       = path.relative(process.cwd(), filePath);
    const vulns     = scanWithLanguagePatterns(source, lang);
    const stability = runStabilityChecks(source, lang, filePath);
    const all       = [...vulns, ...stability];

    if (all.length === 0) {
      process.stdout.write(c.green(`  + ${rel}\n`));
      return;
    }

    const critical = all.filter(i => i.severity === 'CRITICAL');
    const high     = all.filter(i => i.severity === 'HIGH');
    const medium   = all.filter(i => i.severity === 'MEDIUM');
    const low      = all.filter(i => i.severity === 'LOW');

    console.log('');
    console.log('  ' + c.white(rel) + c.faint(`  [${lang}]`));
    console.log('  ' + rule(48));

    const counts = [
      critical.length ? c.red(`${critical.length} critical`) : '',
      high.length     ? c.amber(`${high.length} high`)       : '',
      medium.length   ? c.yellow(`${medium.length} medium`)  : '',
      low.length      ? c.blue(`${low.length} low`)          : '',
    ].filter(Boolean).join(c.faint('  ·  '));
    console.log('  ' + counts);

    for (const issue of [...critical, ...high].slice(0, 3)) {
      const id   = 'patternId' in issue ? (issue as {patternId:string}).patternId : (issue as {id:string}).id;
      const name = 'name'      in issue ? (issue as {name:string}).name           : issue.category;
      const msg  = 'plain'     in issue ? (issue as {plain:string}).plain         : (issue as {message:string}).message;

      console.log('');
      console.log('  ' + sevBadge(issue.severity) + c.faint(`  [${id}]`) + '  ' + c.white(name));
      console.log('  ' + c.faint(`line ${issue.line}  `) + c.dim(issue.snippet));
      console.log('  ' + c.faint('→  ') + c.label(msg));
      console.log('  ' + c.teal('fix  ') + c.dim(issue.fixHint));
    }

    if (all.length > 3) {
      console.log('');
      console.log('  ' + c.faint(`+ ${all.length - 3} more  ·  sork scan --file ${rel}`));
    }

    console.log('');
  } catch { /* skip */ }
}

export async function guardProject(projectPath: string): Promise<void> {
  const absPath = path.resolve(projectPath);

  console.log('');
  console.log(c.faint('  ╭' + '─'.repeat(50) + '╮'));
  console.log(c.faint('  │') + c.teal('  SORK Guard') + c.faint('  ·  watching for changes') + c.faint(' '.repeat(11) + '│'));
  console.log(c.faint('  │') + c.faint('  ' + absPath.slice(0, 46).padEnd(48) + '│'));
  console.log(c.faint('  ╰' + '─'.repeat(50) + '╯'));
  console.log('');
  console.log('  ' + c.label('Initial scan'));
  console.log('  ' + c.faint('─'.repeat(50)));

  const files = await fg('**/*', {
    cwd: absPath,
    ignore: [...IGNORE].map(d => `**/${d}/**`),
    onlyFiles: true,
  });

  const sourceFiles = files.filter((f: string) => shouldWatch(f));
  console.log('  ' + c.faint(`${sourceFiles.length} source files found`));
  console.log('');

  for (const f of sourceFiles.slice(0, 20)) {
    await scanFile(path.join(absPath, f));
  }
  if (sourceFiles.length > 20) {
    console.log(c.faint(`  ... ${sourceFiles.length - 20} more files  ·  sork scan for full report`));
  }

  console.log('');
  console.log('  ' + c.teal('watching') + c.faint('  ·  ctrl+c to stop'));
  console.log('');

  const watcher = watch(absPath, { recursive: true }, async (_ev, filename) => {
    if (!filename) return;
    const full = path.join(absPath, filename);
    if (!shouldWatch(full)) return;
    process.stdout.write(c.faint(`  ~ ${path.relative(absPath, full)}\n`));
    await new Promise(r => setTimeout(r, 150));
    await scanFile(full);
  });

  process.on('SIGINT', () => {
    watcher.close();
    console.log('');
    console.log(c.faint('  guard stopped'));
    console.log('');
    process.exit(0);
  });
}
