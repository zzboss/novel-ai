/**
 * Agent 工厂 - 负责创建和管理 Agent 实例
 */

import type { AgentType } from '@/agents/types'
import { BaseAgent } from '@/agents/base'
import { ChapterAgent } from '@/agents/ChapterAgent'
import { ConsistencyAgent } from '@/agents/ConsistencyAgent'
import { ForeshadowAgent } from '@/agents/ForeshadowAgent'
import { StateExtractorAgent } from '@/agents/StateExtractorAgent'
import { SummaryAgent } from '@/agents/SummaryAgent'
import { ReviserAgent } from '@/agents/ReviserAgent'

/**
 * Agent 实例缓存
 */
const agentInstances: Map<AgentType, BaseAgent> = new Map()

/**
 * 获取或创建 Agent 实例（单例模式）
 */
export function getOrCreateAgent(agentType: AgentType): BaseAgent {
  if (!agentInstances.has(agentType)) {
    let agent: BaseAgent

    switch (agentType) {
      case 'chapter':
        agent = new ChapterAgent()
        break
      case 'consistency':
        agent = new ConsistencyAgent()
        break
      case 'foreshadow':
        agent = new ForeshadowAgent()
        break
      case 'state_extractor':
        agent = new StateExtractorAgent()
        break
      case 'summary':
        agent = new SummaryAgent()
        break
      case 'reviser':
        agent = new ReviserAgent()
        break
      default:
        throw new Error(`未支持的 Agent 类型: ${agentType}`)
    }

    agentInstances.set(agentType, agent)
  }

  return agentInstances.get(agentType)!
}

/**
 * 清除 Agent 实例缓存
 */
export function clearAgentCache(): void {
  agentInstances.clear()
}

/**
 * 获取已缓存的 Agent 类型列表
 */
export function getCachedAgentTypes(): AgentType[] {
  return Array.from(agentInstances.keys())
}
