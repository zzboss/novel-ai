/**
 * LLM 交互记录 Repository
 * 
 * 负责 llm_interactions 表的 CRUD 操作
 * 记录完整的大模型交互过程（输入 prompt + 输出 response + 元数据）
 */

import type { Database } from 'sql.js';
import { queryOne, queryAll, run } from '../index';

// ==================== 类型定义 ====================

export interface LLMInteraction {
  id?: number;
  interaction_id: string;
  operation_type: string;
  model_provider: string;
  model_name: string;
  prompt_template_name?: string;
  input_prompt: string;
  input_parameters?: string;
  output_response: string;
  tokens_input?: number;
  tokens_output?: number;
  duration_ms?: number;
  status: 'success' | 'error' | 'cancelled';
  error_message?: string;
  timestamp: number;
  date: string;
  created_at?: number;
}

export interface LLMInteractionCreateInput {
  interaction_id?: string;
  operation_type: string;
  model_provider: string;
  model_name: string;
  prompt_template_name?: string;
  input_prompt: string;
  input_parameters?: Record<string, unknown>;
  output_response: string;
  tokens_input?: number;
  tokens_output?: number;
  duration_ms?: number;
  status?: 'success' | 'error' | 'cancelled';
  error_message?: string;
  timestamp?: number;
}

// ==================== 插入操作 ====================

/**
 * 保存单条 LLM 交互记录
 */
export function saveLLMInteraction(db: Database, input: LLMInteractionCreateInput): LLMInteraction {
  const interaction_id = input.interaction_id || `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = input.timestamp || Date.now();
  const date = new Date(timestamp).toISOString().split('T')[0];
  const status = input.status || 'success';
  const input_parameters = input.input_parameters ? JSON.stringify(input.input_parameters) : null;

  run(db, `
    INSERT INTO llm_interactions (
      interaction_id, operation_type, model_provider, model_name,
      prompt_template_name, input_prompt, input_parameters,
      output_response, tokens_input, tokens_output,
      duration_ms, status, error_message, timestamp, date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    interaction_id,
    input.operation_type,
    input.model_provider,
    input.model_name,
    input.prompt_template_name || null,
    input.input_prompt,
    input_parameters,
    input.output_response,
    input.tokens_input || null,
    input.tokens_output || null,
    input.duration_ms || null,
    status,
    input.error_message || null,
    timestamp,
    date
  ]);

  return getLLMInteractionByInteractionId(db, interaction_id)!;
}

// ==================== 查询操作 ====================

/**
 * 根据 interaction_id 获取记录
 */
export function getLLMInteractionByInteractionId(db: Database, interaction_id: string): LLMInteraction | null {
  return queryOne(db, 'SELECT * FROM llm_interactions WHERE interaction_id = ?', [interaction_id]) as LLMInteraction | null;
}

/**
 * 根据 ID 获取记录
 */
export function getLLMInteractionById(db: Database, id: number): LLMInteraction | null {
  return queryOne(db, 'SELECT * FROM llm_interactions WHERE id = ?', [id]) as LLMInteraction | null;
}

/**
 * 按日期查询记录
 */
export function getLLMInteractionsByDate(db: Database, date: string): LLMInteraction[] {
  return queryAll(db, `
    SELECT * FROM llm_interactions 
    WHERE date = ? 
    ORDER BY timestamp DESC
  `, [date]) as LLMInteraction[];
}

/**
 * 按日期范围查询记录
 */
export function getLLMInteractionsByDateRange(
  db: Database, 
  startDate: string, 
  endDate: string
): LLMInteraction[] {
  return queryAll(db, `
    SELECT * FROM llm_interactions 
    WHERE date >= ? AND date <= ? 
    ORDER BY timestamp DESC
  `, [startDate, endDate]) as LLMInteraction[];
}

/**
 * 按操作类型查询记录
 */
export function getLLMInteractionsByOperationType(
  db: Database, 
  operationType: string
): LLMInteraction[] {
  return queryAll(db, `
    SELECT * FROM llm_interactions 
    WHERE operation_type = ? 
    ORDER BY timestamp DESC
  `, [operationType]) as LLMInteraction[];
}

/**
 * 获取所有有记录的日期列表
 */
export function getLLMInteractionDistinctDates(db: Database): string[] {
  const rows = queryAll(db, `
    SELECT DISTINCT date FROM llm_interactions 
    ORDER BY date DESC
  `) as Array<{ date: string }>;
  return rows.map(row => row.date);
}

/**
 * 获取所有有记录的日期列表（包含记录数量）
 */
export function getLLMInteractionDistinctDatesWithCount(db: Database): Array<{ date: string; count: number }> {
  return getLLMDistinctDatesWithCount(db);
}

/**
 * 获取所有有记录的日期列表（包含记录数量）- 正确实现
 */
export function getLLMDistinctDatesWithCount(db: Database): Array<{ date: string; count: number }> {
  return queryAll(db, `
    SELECT date, COUNT(*) as count 
    FROM llm_interactions 
    GROUP BY date 
    ORDER BY date DESC
  `) as Array<{ date: string; count: number }>;
}

/**
 * 获取指定日期的记录数量
 */
export function getLLMInteractionCountByDate(db: Database, date: string): number {
  const row = queryOne(db, 'SELECT COUNT(*) as count FROM llm_interactions WHERE date = ?', [date]) as { count: number };
  return row.count;
}

/**
 * 获取总记录数量
 */
export function getTotalLLMInteractionCount(db: Database): number {
  const row = queryOne(db, 'SELECT COUNT(*) as count FROM llm_interactions', []) as { count: number };
  return row.count;
}

/**
 * 获取最近 N 条记录
 */
export function getRecentLLMInteractions(db: Database, limit: number = 50): LLMInteraction[] {
  return queryAll(db, `
    SELECT * FROM llm_interactions 
    ORDER BY timestamp DESC 
    LIMIT ?
  `, [limit]) as LLMInteraction[];
}

// ==================== 删除操作 ====================

/**
 * 根据 ID 删除记录
 */
export function deleteLLMInteractionById(db: Database, id: number): void {
  run(db, 'DELETE FROM llm_interactions WHERE id = ?', [id]);
}

/**
 * 根据 interaction_id 删除记录
 */
export function deleteLLMInteractionByInteractionId(db: Database, interaction_id: string): void {
  run(db, 'DELETE FROM llm_interactions WHERE interaction_id = ?', [interaction_id]);
}

/**
 * 按日期批量删除
 */
export function deleteLLMInteractionsByDate(db: Database, date: string): void {
  run(db, 'DELETE FROM llm_interactions WHERE date = ?', [date]);
}

/**
 * 按日期范围删除
 */
export function deleteLLMInteractionsByDateRange(
  db: Database, 
  startDate: string, 
  endDate: string
): void {
  run(db, 'DELETE FROM llm_interactions WHERE date >= ? AND date <= ?', [startDate, endDate]);
}

/**
 * 按操作类型删除
 */
export function deleteLLMInteractionsByOperationType(
  db: Database, 
  operationType: string
): void {
  run(db, 'DELETE FROM llm_interactions WHERE operation_type = ?', [operationType]);
}

/**
 * 清空所有记录
 */
export function clearAllLLMInteractions(db: Database): void {
  run(db, 'DELETE FROM llm_interactions', []);
}
