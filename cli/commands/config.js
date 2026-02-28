/**
 * Config Command Handler
 *
 * Handles setting and model configuration commands
 */

import { ConfigManager } from '../config.js';
import { success, error, info } from '../banner.js';
import chalk from 'chalk';

const configManager = new ConfigManager();

/**
 * Show current configuration
 */
export async function showConfig() {
  const config = configManager.getLLMConfig();

  console.log(chalk.blue('\n=== LLM Configuration ===\n'));
  console.log(chalk.white(`Provider: ${chalk.cyan(config.provider)}`));
  console.log(chalk.white(`Base URL: ${chalk.cyan(config.baseUrl)}`));
  console.log(chalk.white(`Model: ${chalk.cyan(config.model)}`));
  console.log(chalk.white(`API Key: ${config.apiKey ? chalk.cyan('********' + config.apiKey.slice(-4)) : chalk.red('Not set')}`));
  console.log(chalk.white(`Temperature: ${chalk.cyan(config.temperature || 0.7)}`));
  console.log(chalk.white(`Max Tokens: ${chalk.cyan(config.maxTokens || 4096)}`));

  const configPath = configManager.getConfigPath();
  console.log(chalk.dim(`\nConfig file: ${configPath}`));

  // Check if configured
  if (!config.apiKey) {
    console.log(chalk.yellow('\nWarning: API key not set. Run:'));
    console.log(chalk.white(`  msw-auto setting --apikey YOUR_API_KEY`));
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

  // If no options, show current config
  if (!provider && !baseurl && !apikey) {
    await showConfig();
  }
}

/**
 * Switch model
 */
export async function modelCmd(model) {
  configManager.setModel(model);
  success(`Model switched to: ${model}`);

  const config = configManager.getLLMConfig();
  info(`Provider: ${config.provider}`);
  info(`Base URL: ${config.baseUrl}`);
}
