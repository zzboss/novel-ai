/**
 * LLM 交互记录服务层 - 封装 Electron IPC 调用
 * 
 * 用于记录完整的大模型交互过程（输入 prompt + 输出 response + 元数据）
 */

import type { 
  LLMInteraction, 
  LLMInteractionCreateInput, 
  LLMInteractionDateCount 
} from '@/types/llmInteraction';

/**
 * 保存单条 LLM 交互记录
 */
export async function saveLLMInteraction(
  projectPath: string,
  input: LLMInteractionCreateInput
): Promise<LLMInteraction> {
  return window.electronAPI?.llmInteraction?.save(projectPath, input) || null;
}

/**
 * 根据 interaction_id 获取记录
 */
export async function getLLMInteractionByInteractionId(
  projectPath: string,
  interactionId: string
): Promise<LLMInteraction | null> {
  return window.electronAPI?.llmInteraction?.getByInteractionId(projectPath, interactionId) || null;
}

/**
 * 根据 ID 获取记录
 */
export async function getLLMInteractionById(
  projectPath: string,
  id: number
): Promise<LLMInteraction | null> {
  return window.electronAPI?.llmInteraction?.getById(projectPath, id) || null;
}

/**
 * 按日期查询记录
 */
export async function getLLMInteractionsByDate(
  projectPath: string,
  date: string
): Promise<LLMInteraction[]> {
  return window.electronAPI?.llmInteraction?.getByDate(projectPath, date) || [];
}

/**
 * 按日期范围查询记录
 */
export async function getLLMInteractionsByDateRange(
  projectPath: string,
  startDate: string,
  endDate: string
): Promise<LLMInteraction[]> {
  return window.electronAPI?.llmInteraction?.getByDateRange(projectPath, startDate, endDate) || [];
}

/**
 * 按操作类型查询记录
 */
export async function getLLMInteractionsByOperationType(
  projectPath: string,
  operationType: string
): Promise<LLMInteraction[]> {
  return window.electronAPI?.llmInteraction?.getByOperationType(projectPath, operationType) || [];
}

/**
 * 获取所有有记录的日期列表（包含记录数量）
 */
export async function getLLMInteractionDistinctDatesWithCount(
  projectPath: string
): Promise<LLMInteractionDateCount[]> {
  return window.electronAPI?.llmInteraction?.getDistinctDatesWithCount(projectPath) || [];
}

/**
 * 获取指定日期的记录数量
 */
export async function getLLMInteractionCountByDate(
  projectPath: string,
  date: string
): Promise<number> {
  return window.electronAPI?.llmInteraction?.getCountByDate(projectPath, date) || 0;
}

/**
 * 获取总记录数量
 */
export async function getTotalLLMInteractionCount(
  projectPath: string
): Promise<number> {
  return window.electronAPI?.llmInteraction?.getTotalCount(projectPath) || 0;
}

/**
 * 获取最近 N 条记录
 */
export async function getRecentLLMInteractions(
  projectPath: string,
  limit: number = 50
): Promise<LLMInteraction[]> {
  return window.electronAPI?.llmInteraction?.getRecent(projectPath, limit) || [];
}

// ==================== 删除操作 ====================

/**
 * 根据 ID 删除记录
 */
export async function deleteLLMInteractionById(
  projectPath: string,
  id: number
): Promise<void> {
  return window.electronAPI?.llmInteraction?.deleteById(projectPath, id);
}

/**
 * 根据 interaction_id 删除记录
 */
export async function deleteLLMInteractionByInteractionId(
  projectPath: string,
  interactionId: string
): Promise<void> {
  return window.electronAPI?.llmInteraction?.deleteByInteractionId(projectPath, interactionId);
}

/**
 * 按日期批量删除
 */
export async function deleteLLMInteractionsByDate(
  projectPath: string,
  date: string
): Promise<void> {
  return window.electronAPI?.llmInteraction?.deleteByDate(projectPath, date);
}

/**
 * 按日期范围删除
 */
export async function deleteLLMInteractionsByDateRange(
  projectPath: string,
  startDate: string,
  endDate: string
): Promise<void> {
  return window.electronAPI?.llmInteraction?.deleteByDateRange(projectPath, startDate, endDate);
}

/**
 * 按操作类型删除
 */
export async function deleteLLMInteractionsByOperationType(
  projectPath: string,
  operationType: string
): Promise<void> {
  return window.electronAPI?.llmInteraction?.deleteByOperationType(projectPath, operationType);
}

/**
 * 清空所有记录
 */
export async function clearAllLLMInteractions(
  projectPath: string
): Promise<void> {
  return window.electronAPI?.llmInteraction?.clearAll(projectPath);
}

// ==================== 辅助函数 ====================

/**
 * 记录 LLM 交互（便捷函数）
 * 
 * @param projectPath - 项目路径
 * @param operationType - 操作类型
 * @param modelConfig - 模型配置
 * @param inputPrompt - 输入 prompt
 * @param outputResponse - 输出响应
 * @param options - 可选参数
 */
export async function logLLMInteraction(
  projectPath: string,
  operationType: string,
  modelConfig: { provider: string; model: string },
  inputPrompt: string,
  outputResponse: string,
  options?: {
    prompt_template_name?: string;
    input_parameters?: Record<string, unknown>;
    tokens_input?: number;
    tokens_output?: number;
    duration_ms?: number;
    status?: 'success' | 'error' | 'cancelled';
    error_message?: string;
  }
): Promise<LLMInteraction | null> {
  try {
    const input: LLMInteractionCreateInput = {
      operation_type: operationType,
      model_provider: modelConfig.provider,
      model_name: modelConfig.model,
      prompt_template_name: options?.prompt_template_name,
      input_prompt: inputPrompt,
      input_parameters: options?.input_parameters,
      output_response: outputResponse,
      tokens_input: options?.tokens_input,
      tokens_output: options?.tokens_output,
      duration_ms: options?.duration_ms,
      status: options?.status || 'success',
      error_message: options?.error_message
    };

    return await saveLLMInteraction(projectPath, input);
  } catch (error) {
    console.error('[LLM Interaction Service] 记录交互失败:', error);
    return null;
  }
}
