/**
 * LLM 交互记录相关类型定义
 * 
 * 用于记录完整的大模型交互过程（输入 prompt + 输出 response + 元数据）
 */

/**
 * LLM 交互记录接口（与数据库表 llm_interactions 对应）
 */
export interface LLMInteraction {
  id?: number;
  interaction_id: string;
  operation_type: string;        // 操作类型：generateIdea, modifyIdea, generateWorld, modifyWorld, etc.
  model_provider: string;       // 模型提供商：openai, claude, ollama, custom
  model_name: string;           // 模型名称
  prompt_template_name?: string; // 使用的 prompt 模板名称（可选）
  input_prompt: string;         // 发送给 LLM 的完整 prompt（渲染后的）
  input_parameters?: string;     // 输入参数（JSON 字符串格式，可选）
  output_response: string;      // LLM 返回的完整响应
  tokens_input?: number;        // 输入 token 数（如果 API 返回）
  tokens_output?: number;       // 输出 token 数（如果 API 返回）
  duration_ms?: number;        // 请求耗时（毫秒）
  status: 'success' | 'error' | 'cancelled'; // 状态
  error_message?: string;      // 如果失败，错误信息
  timestamp: number;           // 交互发生的时间戳
  date: string;                // 日期（YYYY-MM-DD 格式）
  created_at?: number;         // 记录创建时间
}

/**
 * 创建 LLM 交互记录的输入参数
 */
export interface LLMInteractionCreateInput {
  interaction_id?: string;
  operation_type: string;
  model_provider: string;
  model_name: string;
  prompt_template_name?: string;
  input_prompt: string;
  input_parameters?: Record<string, unknown> | string;
  output_response: string;
  tokens_input?: number;
  tokens_output?: number;
  duration_ms?: number;
  status?: 'success' | 'error' | 'cancelled';
  error_message?: string;
  timestamp?: number;
}

/**
 * 日期-数量对（用于日期列表展示）
 */
export interface LLMInteractionDateCount {
  date: string;
  count: number;
}

/**
 * 操作类型枚举（常用）
 */
export enum LLMOperationType {
  GENERATE_IDEA = 'generateIdea',
  MODIFY_IDEA = 'modifyIdea',
  GENERATE_WORLD = 'generateWorld',
  MODIFY_WORLD = 'modifyWorld',
  GENERATE_OUTLINE = 'generateOutline',
  MODIFY_OUTLINE = 'modifyOutline',
  GENERATE_CHARACTER = 'generateCharacter',
  MODIFY_CHARACTER = 'modifyCharacter',
  GENERATE_CHAPTER = 'generateChapter',
  POLISH_CHAPTER = 'polishChapter',
  CONTINUE_CHAPTER = 'continueChapter',
  DIALOGUE = 'dialogue'
}

/**
 * 模型提供商枚举
 */
export enum LLMModelProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama',
  CUSTOM = 'custom'
}
