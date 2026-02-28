import chalk from 'chalk';

export class Logger {
  private context: string;

  constructor(context: string = 'SORK') {
    this.context = context;
  }

  private timestamp(): string {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  info(message: string): void {
    console.log(
      `${chalk.dim(this.timestamp())} ${chalk.blue('ℹ')} ${chalk.dim(
        this.context
      )} ${message}`
    );
  }

  success(message: string): void {
    console.log(
      `${chalk.dim(this.timestamp())} ${chalk.green('✓')} ${chalk.dim(
        this.context
      )} ${chalk.green(message)}`
    );
  }

  warn(message: string): void {
    console.log(
      `${chalk.dim(this.timestamp())} ${chalk.yellow('⚠')} ${chalk.dim(
        this.context
      )} ${chalk.yellow(message)}`
    );
  }

  error(message: string): void {
    console.log(
      `${chalk.dim(this.timestamp())} ${chalk.red('✗')} ${chalk.dim(
        this.context
      )} ${chalk.red(message)}`
    );
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(
        `${chalk.dim(this.timestamp())} ${chalk.gray('⚙')} ${chalk.dim(
          this.context
        )} ${chalk.gray(message)}`
      );
    }
  }

  section(title: string): void {
    console.log(`\n${chalk.bold(title)}`);
    console.log(chalk.dim('─'.repeat(50)));
  }

  table(data: Record<string, unknown>[]): void {
    console.table(data);
  }
}
