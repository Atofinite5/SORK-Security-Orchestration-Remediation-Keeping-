import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

const VSCODE_TASKS = {
  version: '2.0.0',
  tasks: [
    {
      label: 'SORK: Scan This File',
      type: 'shell',
      command: 'sork send ${relativeFile}',
      problemMatcher: [],
      presentation: { reveal: 'always', panel: 'new' },
      group: { kind: 'test', isDefault: false },
    },
    {
      label: 'SORK: Scan Project',
      type: 'shell',
      command: 'sork scan',
      problemMatcher: [],
      presentation: { reveal: 'always', panel: 'shared' },
      group: 'test',
    },
    {
      label: 'SORK: Open Dashboard',
      type: 'shell',
      command: 'sork send',
      problemMatcher: [],
      presentation: { reveal: 'silent' },
    },
  ],
};

const VSCODE_KEYBINDINGS_HINT = `
# Add to your VS Code keybindings.json (Cmd+Shift+P → "Open Keyboard Shortcuts JSON"):
#
# { "key": "ctrl+shift+s", "command": "workbench.action.tasks.runTask", "args": "SORK: Scan This File" }
# { "key": "ctrl+shift+d", "command": "workbench.action.tasks.runTask", "args": "SORK: Open Dashboard" }
`;

export async function hookVscode(projectPath: string): Promise<void> {
  const vscodeDir = path.join(projectPath, '.vscode');
  const tasksFile = path.join(vscodeDir, 'tasks.json');
  const keybindHint = path.join(vscodeDir, 'sork-keybindings.txt');

  await fs.mkdir(vscodeDir, { recursive: true });

  // Merge with existing tasks.json if it exists
  let existingTasks: { version: string; tasks: unknown[] } = { version: '2.0.0', tasks: [] };
  try {
    const raw = await fs.readFile(tasksFile, 'utf-8');
    existingTasks = JSON.parse(raw);
  } catch {
    // fresh file
  }

  const existingLabels = new Set(
    (existingTasks.tasks ?? []).map((t) => (t as { label: string }).label)
  );
  const newTasks = VSCODE_TASKS.tasks.filter((t) => !existingLabels.has(t.label));
  existingTasks.tasks = [...(existingTasks.tasks ?? []), ...newTasks];

  await fs.writeFile(tasksFile, JSON.stringify(existingTasks, null, 2));
  await fs.writeFile(keybindHint, VSCODE_KEYBINDINGS_HINT);

  console.log(chalk.green('✓') + ' Created ' + chalk.cyan('.vscode/tasks.json'));
  console.log(chalk.green('✓') + ' Created ' + chalk.cyan('.vscode/sork-keybindings.txt'));
  console.log('');
  console.log(chalk.bold('In VS Code:'));
  console.log(
    '  ' +
      chalk.dim('Cmd+Shift+P') +
      ' → ' +
      chalk.cyan('Tasks: Run Task') +
      ' → ' +
      chalk.yellow('SORK: Scan This File')
  );
  console.log(
    '  ' +
      chalk.dim('Cmd+Shift+P') +
      ' → ' +
      chalk.cyan('Tasks: Run Task') +
      ' → ' +
      chalk.yellow('SORK: Open Dashboard')
  );
  console.log('');
  console.log(
    chalk.dim('Tip: See .vscode/sork-keybindings.txt to bind a hotkey (e.g. Ctrl+Shift+S)')
  );
}
