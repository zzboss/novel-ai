import type { LLMProviderType, ModelConfig } from './types'
import { OpenAIAdapter } from './adapters/OpenAIAdapter'
// TODO: 修复类型错误后取消注释
// import { ClaudeAdapter } from './adapters/ClaudeAdapter'
// import { OllamaAdapter } from './adapters/OllamaAdapter'
// import { CustomAdapter } from './adapters/CustomAdapter'

/**
 * LLM 适配器工厂
 * 根据配置创建对应的适配器实例（单例模式）
 * 
 * 设计模式说明：
 * - 使用单例模式缓存适配器实例，避免重复创建
 * - 本地模型（Ollama/LM Studio）复用 OpenAI 兼容适配器
 * - 通义千问、DeepSeek、豆包等云端模型也兼容 OpenAI 格式
 */
export class LLMProviderFactory {
  /** 缓存已创建的适配器实例 */
  private static instances: Map<string, unknown> = new Map()

  /**
   * 根据模型配置创建对应的适配器实例
   * @param config - 模型配置对象
   * @returns LLM 适配器实例
   */
  static create(config: ModelConfig): import('./types').LLMAdapter {
    const provider = config.provider

    // 本地模型复用 OpenAI 兼容适配器
    if (provider === 'ollama' || provider === 'lmstudio') {
      return this.getOrCreate('openai-compatible', () => new OpenAIAdapter())
    }

    // 通义千问、DeepSeek、豆包、GLM、Gemini 均兼容 OpenAI 格式
    const openAICompatibleProviders: LLMProviderType[] = ['qwen', 'deepseek', 'doubao', 'GLM', 'gemini']
    if (openAICompatibleProviders.includes(provider)) {
      return this.getOrCreate(`openai-compatible-${config.baseURL || config.provider}`, () => new OpenAIAdapter())
    }

    // 根据提供商类型创建对应适配器
    switch (provider) {
      case 'openai':
        return this.getOrCreate('openai', () => new OpenAIAdapter())
      case 'claude':
        // TODO: 取消注释当 ClaudeAdapter 修复后
        // return this.getOrCreate('claude', () => new ClaudeAdapter())
        throw new Error('Claude 适配器暂时禁用，请使用 OpenAI 兼容模式')
      case 'custom':
        // TODO: 取消注释当 CustomAdapter 修复后
        // return this.getOrCreate(`custom-${config.baseURL || ''}`, () => new CustomAdapter())
        throw new Error('自定义适配器暂时禁用，请使用 OpenAI 兼容模式')
      default:
        throw new Error(`不支持的 LLM 提供商: ${provider}`)
    }
  }

  /**
   * 获取已缓存的适配器实例，如不存在则创建新实例
   * @param key - 缓存键名
   * @param factory - 创建新实例的工厂函数
   * @returns 适配器实例
   */
  private static getOrCreate<T>(key: string, factory: () => T): T {
    if (!this.instances.has(key)) {
      this.instances.set(key, factory())
    }
    return this.instances.get(key) as T
  }
}
