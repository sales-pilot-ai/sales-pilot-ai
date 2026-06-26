import chalk from 'chalk';

export const logger = {
  info: (msg) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✔'), msg),
  warn: (msg) => console.log(chalk.yellow('⚠'), msg),
  error: (msg) => console.error(chalk.red('✖'), msg),
  step: (msg) => console.log(chalk.blue('→'), msg),
};
