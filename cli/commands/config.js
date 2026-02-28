/**
 * Config Command Handler
 *
 * Handles setting and model configuration commands
 */

import { ConfigManager } from '../config.js';
import { success, error, info } from '../banner.js';
import chalk from 'chalk';
import { t, getCurrentLang } from '../i18n.js';

const configManager = new ConfigManager();

/**
 * Show current configuration
 */
export async function showConfig() {
  const config = configManager.getLLMConfig();
  const lang = getCurrentLang();

  console.log(chalk.blue(`\n=== ${t('config.title')} ===\n`));
  console.log(chalk.white(`${t('config.provider')}: ${chalk.cyan(config.provider)}`));
  console.log(chalk.white(`${t('config.baseUrl')}: ${chalk.cyan(config.baseUrl)}`));
  console.log(chalk.white(`${t('config.model')}: ${chalk.cyan(config.model)}`));
  console.log(chalk.white(`${t('config.apiKey')}: ${config.apiKey ? chalk.cyan('********' + config.apiKey.slice(-4)) : chalk.red(t('config.notSet'))}`));

  const configPath = configManager.getConfigPath();
  console.log(chalk.dim(`\nConfig file: ${configPath}`));

  // Check if configured
  if (!config.apiKey) {
    console.log(chalk.yellow(`\n${t('config.warning')}: ${t('config.runSetting')}`));
  }
}

/**
 * Update LLM settings
 */
export async function configCmd(argv) {
  const { provider, baseurl, apikey } = argv;

  // Set provider
  if (provider) {
    configManager.setProvider(provider);
    success(`Provider set to: ${provider}`);
  }

  // Set base URL
  if (baseurl) {
    configManager.setBaseUrl(baseurl);
    success(`Base URL set to: ${baseurl}`);
  }

  // Set API key
  if (apikey) {
    configManager.setApiKey(apikey);
    success(`API key updated`);
  }
}

/**
 * Switch LLM model
 */
export async function modelCmd(model) {
  if (!model) {
    error('Model name is required');
    return;
  }

  configManager.setModel(model);
  success(`Model set to: ${model}`);
}
