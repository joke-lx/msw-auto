/**
 * LLM Config Manager
 *
 * Manages LLM configuration (baseUrl, apiKey, model)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_CONFIG = {
  llm: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4096,
  },
  projects: {},
  defaults: {
    mockPort: 3001,
    webPort: 3000,
  },
};

/**
 * Config Manager
 */
export class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.msw-auto', 'config.json');
    this.config = this.load();
  }

  /**
   * Load config from file
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore errors
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save config to file
   */
  save() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get LLM config
   */
  getLLMConfig() {
    return this.config.llm;
  }

  /**
   * Update LLM config
   */
  updateLLMConfig(updates) {
    this.config.llm = { ...this.config.llm, ...updates };
    this.save();
  }

  /**
   * Set provider
   */
  setProvider(provider) {
    const presets = {
      anthropic: {
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20241022',
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      },
      custom: {
        baseUrl: '',
        model: '',
      },
    };

    this.config.llm = {
      ...this.config.llm,
      provider,
      ...presets[provider],
    };
    this.save();
  }

  /**
   * Set model
   */
  setModel(model) {
    this.config.llm.model = model;
    this.save();
  }

  /**
   * Set API key
   */
  setApiKey(apiKey) {
    this.config.llm.apiKey = apiKey;
    this.save();
  }

  /**
   * Set base URL
   */
  setBaseUrl(baseUrl) {
    this.config.llm.baseUrl = baseUrl;
    this.save();
  }

  /**
   * Get config path
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * Get all config
   */
  getAll() {
    return this.config;
  }

  /**
   * Check if LLM is configured
   */
  isConfigured() {
    return !!this.config.llm.apiKey;
  }
}
