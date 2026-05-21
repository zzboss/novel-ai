/**
 * AgentQueueManager 常量定义
 */

import type { PipelineStep } from './types'

/**
 * 章节生成管线步骤定义
 */
export const PIPELINE_STEPS: PipelineStep[] = [
  { step: 1, name: '意图编译', agentType: 'intent_compiler', usesLLM: false, description: '从大纲+StoryState推导章节意图书' },
  { step: 2, name: '上下文裁剪', agentType: 'context_builder', usesLLM: false, description: '按Token预算分层裁剪上下文' },
  { step: 3, name: '章节草稿', agentType: 'chapter', usesLLM: true, description: '根据意图书+上下文生成章节正文' },
  { step: 4, name: '状态提取', agentType: 'state_extractor', usesLLM: true, description: '从草稿提取9维结构化事实' },
  { step: 5, name: '一致性审计', agentType: 'consistency', usesLLM: true, description: '程序化+LLM三层审计' },
  { step: 6, name: '定点修复', agentType: 'reviser', usesLLM: true, description: '修复审计发现的关键问题' },
  { step: 7, name: '状态更新', agentType: 'state_updater', usesLLM: false, description: '程序化增量合并StoryState' }
]

/** 最大修复循环次数 */
export const MAX_REVISION_CYCLES = 3
