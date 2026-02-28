/**
 * LLM Service
 *
 * Unified LLM service for MCP tools
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get LLM config from file
 */
function getLLMConfig() {
  const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
  const baseDir = isCI ? process.env.TMPDIR || '/tmp' : os.homedir();
  const configPath = path.join(baseDir, '.msw-auto', 'config.json');

  const defaultConfig = {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4096,
  };

  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...defaultConfig, ...data.llm };
    }
  } catch {
    // Ignore
  }

  return defaultConfig;
}

/**
 * LLM Service class
 */
export class LLMService {
  private config;
  private anthropic: any;

  constructor() {
    this.config = getLLMConfig();

    if (this.config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl !== 'https://api.anthropic.com'
          ? this.config.baseUrl
          : undefined,
      });
    }
  }

  /**
   * Reload config
   */
  reload() {
    this.config = getLLMConfig();

    if (this.config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl !== 'https://api.anthropic.com'
          ? this.config.baseUrl
          : undefined,
      });
    }
  }

  /**
   * Check if LLM is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Send message to LLM
   */
  async sendMessage(system: string, user: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('LLM API key not configured. Run: msw-auto setting --apikey YOUR_KEY');
    }

    if (this.config.provider === 'anthropic') {
      return this.sendAnthropicMessage(system, user);
    }

    // OpenAI compatible API (OpenAI, Qwen, Custom)
    return this.sendOpenAICompatibleMessage(system, user);
  }

  private async sendAnthropicMessage(system: string, user: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
      system: [{ type: 'text', text: system }],
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    });

    return message.content[0]?.text || '';
  }

  private async sendOpenAICompatibleMessage(system: string, user: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate mock data for an endpoint
   */
  async generateMock(
    method: string,
    endpointPath: string,
    context?: string
  ): Promise<any> {
    const system = `你是一个专业的 Mock 数据生成专家。根据 API 端点信息生成符合业务逻辑的 JSON 响应数据。`;

    const user = `请为以下 API 端点生成 Mock 响应数据：

方法: ${method}
路径: ${endpointPath}
${context ? `业务上下文: ${context}` : ''}

请只返回 JSON 数据，不要其他解释。`;

    const response = await this.sendMessage(system, user);

    // Try to parse JSON
    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                       response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch {
      return { message: response };
    }
  }

  /**
   * Get current config
   */
  getConfig() {
    return this.config;
  }
}

// Export singleton
export const llmService = new LLMService();
