/**
 * LLM Client
 *
 * Unified LLM client supporting multiple providers
 */

import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig } from './config.js';

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * LLM Client
 */
export class LLMClient {
  private config: LLMConfig;
  private client: any;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  private createClient() {
    switch (this.config.provider) {
      case 'anthropic':
        return new Anthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl || undefined,
        });

      case 'openai':
      case 'qwen':
      case 'custom':
        // 使用 OpenAI 兼容的 API
        return {
          baseURL: this.config.baseUrl,
          apiKey: this.config.apiKey,
          // 动态创建 fetch 请求
        };

      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Send a message to LLM
   */
  async sendMessage(
    system: string,
    user: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const temperature = options?.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? 4096;

    if (this.config.provider === 'anthropic') {
      return this.sendAnthropicMessage(system, user, temperature, maxTokens);
    }

    // OpenAI 兼容 API
    return this.sendOpenAICompatibleMessage(system, user, temperature, maxTokens);
  }

  private async sendAnthropicMessage(
    system: string,
    user: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const message = await this.client.messages.create({
      model: this.config.model,
      max_tokens: maxTokens,
      temperature,
      system: [{ type: 'text', text: system }],
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    });

    const content = message.content[0]?.text || '';

    return {
      content,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }

  private async sendOpenAICompatibleMessage(
    system: string,
    user: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature,
        max_tokens: maxTokens,
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
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      usage: data.usage,
    };
  }

  /**
   * Generate mock data for an endpoint
   */
  async generateMock(
    endpoint: { method: string; path: string },
    context?: string
  ): Promise<any> {
    const system = `你是一个专业的 Mock 数据生成专家。根据 API 端点信息生成符合业务逻辑的 JSON 响应数据。`;

    const user = `请为以下 API 端点生成 Mock 响应数据：

方法: ${endpoint.method}
路径: ${endpoint.path}
${context ? `\n业务上下文: ${context}` : ''}

请只返回 JSON 数据，不要其他解释。`;

    const response = await this.sendMessage(system, user);

    // 尝试解析 JSON
    try {
      // 提取 JSON 部分
      const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                       response.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.content;
      return JSON.parse(jsonStr);
    } catch {
      // 如果解析失败，返回原始文本
      return { message: response.content };
    }
  }

  /**
   * Generate multiple mocks
   */
  async generateMocks(
    endpoints: Array<{ method: string; path: string }>,
    progress?: (current: number, total: number) => void
  ): Promise<Array<{ endpoint: { method: string; path: string }; data: any }>> {
    const results = [];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      const data = await this.generateMock(endpoint);
      results.push({ endpoint, data });

      if (progress) {
        progress(i + 1, endpoints.length);
      }
    }

    return results;
  }
}
