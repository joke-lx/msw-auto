/**
 * Interactive CLI Menu
 *
 * Provides an interactive menu for managing MSW Auto
 */

import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { t, setLanguage, getCurrentLang } from './i18n.js';

const execAsync = promisify(exec);

/**
 * Main interactive menu
 */
export async function menu() {
  let running = true;

  while (running) {
    const action = await select({
      message: t('menu.title'),
      choices: [
        {
          name: t('menu.startServer'),
          value: 'start',
          description: 'Start the mock server',
        },
        {
          name: t('menu.startWeb'),
          value: 'web',
          description: 'Start the Web UI',
        },
        {
          name: t('menu.configureLlm'),
          value: 'config',
          description: 'Configure LLM settings',
        },
        {
          name: getCurrentLang() === 'zh' ? '切换语言' : 'Switch Language',
          value: 'lang',
          description: 'Switch between Chinese and English',
        },
        {
          name: t('menu.showConfig'),
          value: 'show',
          description: 'Show current configuration',
        },
        {
          name: t('menu.exit'),
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
      case 'lang':
        await switchLanguageMenu();
        break;
      case 'show':
        await showConfigMenu();
        break;
      case 'exit':
        running = false;
        console.log(chalk.green(t('menu.goodbye')));
        break;
    }
  }
}

async function startServerMenu() {
  const port = await select({
    message: t('menu.portSelect'),
    choices: [
      { name: '3001 (' + t('ports.default') + ')', value: '3001' },
      { name: '3002', value: '3002' },
      { name: '8080', value: '8080' },
    ],
  });

  const spinner = ora(t('menu.starting')).start();
  try {
    await execAsync(`npx msw-auto server --port ${port}`);
    spinner.succeed(t('menu.success'));
  } catch (error) {
    spinner.fail(t('menu.failed'));
    console.error(error.message);
  }
}

async function startWebMenu() {
  const port = await select({
    message: t('menu.webPortSelect'),
    choices: [
      { name: '3000 (' + t('ports.default') + ')', value: '3000' },
      { name: '3001', value: '3001' },
      { name: '8080', value: '8080' },
    ],
  });

  const spinner = ora(t('menu.starting')).start();
  try {
    await execAsync(`npx msw-auto web --port ${port}`);
    spinner.succeed(t('menu.success'));
  } catch (error) {
    spinner.fail(t('menu.failed'));
    console.error(error.message);
  }
}

async function configMenu() {
  const provider = await select({
    message: t('menu.providerSelect'),
    choices: [
      { name: t('providers.anthropic'), value: 'anthropic' },
      { name: t('providers.openai'), value: 'openai' },
      { name: t('providers.custom'), value: 'custom' },
    ],
  });

  const spinner = ora(t('menu.starting')).start();

  try {
    await execAsync(`npx msw-auto setting --provider ${provider}`);

    // If custom provider, ask for baseurl
    if (provider === 'custom') {
      spinner.stop();
      const baseurl = await input({
        message: getCurrentLang() === 'zh' ? '请输入 Base URL:' : 'Enter Base URL:',
      });
      if (baseurl) {
        await execAsync(`npx msw-auto setting --baseurl ${baseurl}`);
      }
    }

    // Ask for API key
    const apiKeyMessage = getCurrentLang() === 'zh' ? '请输入 API Key:' : 'Enter API Key:';
    const apiKey = await input({
      message: apiKeyMessage,
    });

    if (apiKey) {
      await execAsync(`npx msw-auto setting --apikey ${apiKey}`);
    }

    spinner.succeed(t('menu.success'));
  } catch (error) {
    spinner.fail(t('menu.failed'));
    console.error(error.message);
  }
}

async function switchLanguageMenu() {
  const lang = await select({
    message: getCurrentLang() === 'zh' ? '选择语言：' : 'Select language:',
    choices: [
      { name: 'English', value: 'en' },
      { name: '中文', value: 'zh' },
    ],
  });

  setLanguage(lang);

  const spinner = ora('...').start();
  spinner.succeed(getCurrentLang() === 'zh' ? '语言已切换！' : 'Language switched!');
}

async function showConfigMenu() {
  const spinner = ora('Loading...').start();
  try {
    await execAsync(`npx msw-auto config`);
    spinner.succeed(t('menu.success'));
  } catch (error) {
    spinner.fail(t('menu.failed'));
    console.error(error.message);
  }
}

/**
 * Show help information
 */
export async function showHelp() {
  console.log(`
${t('banner.title')} - ${t('banner.subtitle')}

${getCurrentLang() === 'zh' ? '命令：' : 'Commands:'}
  init          ${t('commands.init')}
  server        ${t('commands.server')}
  web           ${t('commands.web')}
  generate      ${t('commands.generate')}
  import        ${t('commands.import')}
  config        ${t('commands.config')}
  setting       ${t('commands.setting')}
  model         ${t('commands.model')}
  interactive   ${t('commands.interactive')}

${getCurrentLang() === 'zh' ? '示例：' : 'Examples:'}
  msw-auto server --port 3001
  msw-auto web --port 3000
  msw-auto setting --provider anthropic --apikey YOUR_KEY
  `);
}
