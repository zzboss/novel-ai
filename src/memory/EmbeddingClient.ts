/**
 * Embedding 客户端
 * 
 * 职责：
 * 1. 提供文本向量化接口（支持多种 Embedding 模型）
 * 2. 处理批量向量化请求
 * 3. 实现缓存机制，避免重复向量化
 * 4. 支持本地和远程 Embedding 模型
 */

import { Database } from 'sql.js'

// ============================================================
// 配置和常量
// ============================================================

// Embedding 模型配置
const EMBEDDING_MODELS = {
  // OpenAI 模型
  'text-embedding-ada-002': {
    dimension: 1536,
    maxBatchSize: 2048,
    provider: 'openai',
  },
  'text-embedding-3-small': {
    dimension: 1536,
    maxBatchSize: 8191,
    provider: 'openai',
  },
  'text-embedding-3-large': {
    dimension: 3072,
    maxBatchSize: 8191,
    provider: 'openai',
  },
  
  // 本地模型（通过 Ollama）
  'nomic-embed-text': {
    dimension: 768,
    maxBatchSize: 2048,
    provider: 'ollama',
  },
  'all-MiniLM-L6-v2': {
    dimension: 384,
    maxBatchSize: 4096,
    provider: 'local',
  },
}

// 默认配置
const DEFAULT_CONFIG = {
  model: 'text-embedding-ada-002',
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  timeout: 30000,  // 30 秒超时
  maxRetries: 3,
  enableCache: true,
  cacheSize: 1000,
}

// ============================================================
// 类型定义
// ============================================================

export interface EmbeddingConfig {
  model?: string
  apiKey?: string
  apiBaseUrl?: string
  timeout?: number
  maxRetries?: number
  enableCache?: boolean
  cacheSize?: number
}

export interface EmbeddingRequest {
  input: string | string[]
  model?: string
  user?: string
}

export interface EmbeddingResponse {
  object: string
  data: Array<{
    object: string
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

// ============================================================
// 核心类定义
// ============================================================

/**
 * Embedding 客户端
 */
export class EmbeddingClient {
  private config: Required<EmbeddingConfig>
  private cache: Map<string, number[]>
  private db: Database | null = null

  constructor(config?: EmbeddingConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.cache = new Map()
  }

  /**
   * 初始化（可选：使用数据库持久化缓存）
   */
  async initialize(db?: Database): Promise<void> {
    if (db) {
      this.db = db
      await this.loadCacheFromDB()
    }
    console.log(`[EmbeddingClient] Initialized with model: ${this.config.model}`)
  }

  /**
   * 获取文本的向量表示
   * @param text 输入文本（单个）
   * @returns 向量数组
   */
  async embed(text: string): Promise<number[]> {
    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.getFromCache(text)
      if (cached) {
        return cached
      }
    }

    // 调用 API
    const response = await this.embedBatch([text])
    const embedding = response.data[0].embedding

    // 更新缓存
    if (this.config.enableCache) {
      this.updateCache(text, embedding)
    }

    return embedding
  }

  /**
   * 批量获取文本的向量表示
   * @param texts 输入文本数组
   * @returns 向量数组的数组
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResponse> {
    if (texts.length === 0) {
      throw new Error('输入文本数组不能为空')
    }

    // 检查缓存（过滤已缓存的结果）
    const uncachedTexts: string[] = []
    const uncachedIndices: number[] = []
    const cachedEmbeddings: (number[] | null)[] = texts.map((text, index) => {
      if (this.config.enableCache) {
        const cached = this.getFromCache(text)
        if (cached) {
          return cached
        }
      }
      uncachedTexts.push(text)
      uncachedIndices.push(index)
      return null
    })

    // 如果有未缓存的文本，调用 API
    if (uncachedTexts.length > 0) {
      const response = await this.callEmbeddingAPI(uncachedTexts)
      
      // 更新缓存和结果
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i]
        const embedding = response.data[i].embedding
        
        if (this.config.enableCache) {
          this.updateCache(text, embedding)
        }
        
        cachedEmbeddings[uncachedIndices[i]] = embedding
      }
    }

    // 构造返回结果
    return {
      object: 'list',
      data: cachedEmbeddings.map((embedding, index) => ({
        object: 'embedding',
        embedding: embedding!,
        index,
      })),
      model: this.config.model,
      usage: {
        prompt_tokens: texts.reduce((sum, text) => sum + this.estimateTokens(text), 0),
        total_tokens: texts.reduce((sum, text) => sum + this.estimateTokens(text), 0),
      },
    }
  }

  /**
   * 获取向量维度
   */
  getDimension(): number {
    const modelConfig = EMBEDDING_MODELS[this.config.model as keyof typeof EMBEDDING_MODELS]
    if (!modelConfig) {
      throw new Error(`未知的 Embedding 模型: ${this.config.model}`)
    }
    return modelConfig.dimension
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    if (this.db) {
      const stmt = this.db.prepare(`DELETE FROM embedding_cache`)
      stmt.run()
      stmt.free()
    }
    console.log('[EmbeddingClient] Cache cleared')
  }

  // ==================== 私有方法 ====================

  /**
   * 调用 Embedding API
   */
  private async callEmbeddingAPI(texts: string[]): Promise<EmbeddingResponse> {
    const modelConfig = EMBEDDING_MODELS[this.config.model as keyof typeof EMBEDDING_MODELS]
    if (!modelConfig) {
      throw new Error(`未知的 Embedding 模型: ${this.config.model}`)
    }

    let lastError: Error | null = null

    // 重试机制
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        let response: EmbeddingResponse

        switch (modelConfig.provider) {
          case 'openai':
            response = await this.callOpenAIEmbedding(texts)
            break
          case 'ollama':
            response = await this.callOllamaEmbedding(texts)
            break
          case 'local':
            response = await this.callLocalEmbedding(texts)
            break
          default:
            throw new Error(`不支持的 Embedding 提供商: ${modelConfig.provider}`)
        }

        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[EmbeddingClient] Attempt ${attempt + 1} failed:`, lastError.message)
        
        if (attempt < this.config.maxRetries - 1) {
          // 等待后重试（指数退避）
          await this.sleep(1000 * Math.pow(2, attempt))
        }
      }
    }

    throw new Error(`Embedding API 调用失败（已重试 ${this.config.maxRetries} 次）: ${lastError?.message}`)
  }

  /**
   * 调用 OpenAI Embedding API
   */
  private async callOpenAIEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    const url = `${this.config.apiBaseUrl}/embeddings`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.config.model,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 错误 ${response.status}: ${errorText}`)
    }

    return await response.json()
  }

  /**
   * 调用 Ollama Embedding API
   */
  private async callOllamaEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    const url = `${this.config.apiBaseUrl}/api/embeddings`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: texts.join('\n---\n'),  // Ollama 不支持批量，用分隔符连接
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API 错误 ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    
    // 转换为标准格式
    return {
      object: 'list',
      data: [{
        object: 'embedding',
        embedding: data.embedding,
        index: 0,
      }],
      model: this.config.model,
      usage: {
        prompt_tokens: this.estimateTokens(texts.join('')),
        total_tokens: this.estimateTokens(texts.join('')),
      },
    }
  }

  /**
   * 调用本地 Embedding 模型
   */
  private async callLocalEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    // TODO: 实现本地 Embedding 模型调用（如使用 @xenova/transformers）
    throw new Error('本地 Embedding 模型尚未实现')
  }

  /**
   * 从缓存获取
   */
  private getFromCache(text: string): number[] | null {
    // 内存缓存
    const cached = this.cache.get(text)
    if (cached) {
      return cached
    }

    // 数据库缓存
    if (this.db) {
      const stmt = this.db.prepare(`SELECT embedding FROM embedding_cache WHERE text = ? AND model = ?`)
      const result = stmt.exec([text, this.config.model])
      stmt.free()

      if (result.length > 0) {
        const embedding = JSON.parse(result[0].embedding)
        this.cache.set(text, embedding)  // 回填内存缓存
        return embedding
      }
    }

    return null
  }

  /**
   * 更新缓存
   */
  private updateCache(text: string, embedding: number[]): void {
    // 内存缓存
    if (this.cache.size >= this.config.cacheSize) {
      // 删除最早的缓存（简单 FIFO）
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(text, embedding)

    // 数据库缓存
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO embedding_cache (text, model, embedding, created_at)
        VALUES (?, ?, ?, ?)
      `)
      stmt.run([text, this.config.model, JSON.stringify(embedding), Date.now()])
      stmt.free()
    }
  }

  /**
   * 从数据库加载缓存
   */
  private async loadCacheFromDB(): Promise<void> {
    if (!this.db) {
      return
    }

    // 确保表存在
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        text TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (text, model)
      )
    `)

    // 加载缓存
    const stmt = this.db.prepare(`SELECT text, embedding FROM embedding_cache WHERE model = ? ORDER BY created_at DESC LIMIT ?`)
    const results = stmt.exec([this.config.model, this.config.cacheSize])
    stmt.free()

    for (const row of results) {
      this.cache.set(row.text, JSON.parse(row.embedding))
    }

    console.log(`[EmbeddingClient] Loaded ${this.cache.size} embeddings from cache`)
  }

  /**
   * 估算 Token 数量（简单估算：1 token ≈ 4 字符）
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * 睡眠（用于重试等待）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================
// 导出
// ============================================================

export {
  EMBEDDING_MODELS,
  DEFAULT_CONFIG,
}

export default EmbeddingClient
