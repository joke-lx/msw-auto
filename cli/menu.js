/**
 * Interactive CLI Menu
 *
 * Provides an interactive menu for managing MSW Auto
 */

import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Main interactive menu
 */
export async function menu() {
  let running = true;

  while (running) {
    const action = await select({
      message: chalk.blue('MSW Auto') + ' - Choose an action:',
      choices: [
        {
          name: 'Start Mock Server',
          value: 'start',
          description: 'Start the mock server',
        },
        {
          name: 'Start Web UI',
          value: 'web',
          description: 'Start the Web UI',
        },
        {
          name: 'Configure LLM',
          value: 'config',
          description: 'Configure LLM settings',
        },
        {
          name: 'Show Config',
          value: 'show',
          description: 'Show current configuration',
        },
        {
          name: 'Exit',
          value: 'exit',
          description: 'Exit the CLI',
        },
      ],
    });

    switch (action) {
      case 'start':
        await startServerMenu();
        break;
      case 'web':
        await startWebMenu();
        break;
      case 'config':
        await configMenu();
        break;
      case 'show':
        await showConfigMenu();
        break;
      case 'exit':
        running = false;
        console.log(chalk.green('Goodbye!'));
        break;
    }
  }
}

async function startServerMenu() {
  const port = await select({
    message: 'Select server port:',
    choices: [
      { name: '3001 (default)', value: '3001' },
      { name: '3002', value: '3002' },
      { name: '8080', value: '8080' },
    ],
  });

  const spinner = ora('Starting mock server...').start();
  try {
    await execAsync(`npx msw-auto server --port ${port}`);
    spinner.succeed('Mock server started');
  } catch (error) {
    spinner.fail('Failed to start server');
    console.error(error.message);
  }
}

async function startWebMenu() {
  const port = await select({
    message: 'Select web port:',
    choices: [
      { name: '3000 (default)', value: '3000' },
      { name: '3001', value: '3001' },
      { name: '8080', value: '8080' },
    ],
  });

  const spinner = ora('Starting web UI...').start();
  try {
    await execAsync(`npx msw-auto web --port ${port}`);
    spinner.succeed('Web UI started');
  } catch (error) {
    spinner.fail('Failed to start web UI');
    console.error(error.message);
  }
}

async function configMenu() {
  const provider = await select({
    message: 'Select LLM provider:',
    choices: [
      { name: 'Anthropic (Claude)', value: 'anthropic' },
      { name: 'OpenAI', value: 'openai' },
      { name: 'Custom', value: 'custom' },
    ],
  });

  const spinner = ora('Configuring LLM...').start();
  try {
    await execAsync(`npx msw-auto setting --provider ${provider}`);
    spinner.succeed('LLM configured');
  } catch (error) {
    spinner.fail('Failed to configure LLM');
    console.error(error.message);
  }
}

async function showConfigMenu() {
  const spinner = ora('Loading config...').start();
  try {
    await execAsync(`npx msw-auto config`);
    spinner.succeed('Config loaded');
  } catch (error) {
    spinner.fail('Failed to load config');
    console.error(error.message);
  }
}

/**
 * Show help information
 */
export async function showHelp() {
  console.log(`
MSW Auto - Intelligent Mock Server

Commands:
  init          Initialize MSW
  server        Start Mock server
  web           Start Web UI
  generate      AI generate Mock
  import        Import from Postman/Swagger
  config        Show LLM configuration
  setting       Configure LLM (--provider, --apikey, --baseurl)
  model         Switch LLM model
  interactive   Start interactive menu

Examples:
  msw-auto server --port 3001
  msw-auto web --port 3000
  msw-auto setting --provider anthropic --apikey YOUR_KEY
  `);
}
