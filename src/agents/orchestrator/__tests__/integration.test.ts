/**
 * Agent 协作集成测试
 * 
 * 测试内容：
 * - Agent 之间的协作
 * - Pipeline 执行
 * - 记忆共享
 * - 消息传递
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { AgentOrchestrator } from '../AgentOrchestrator'
import { BaseAgent } from '../base'
import type { AgentInput, AgentOutput, AgentContext } from '../types'

// ==================== 模拟 Agent ===================

class IdeaAgent extends BaseAgent {
  readonly agentType = 'idea' as const
  
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    // 模拟执行：返回包含输入提示词的输出
    return {
      content: `IdeaAgent output for: ${(input as any).prompt || 'unknown'}`,
      tokensUsed: 100
    }
  }
  
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    yield `IdeaAgent stream output for: ${(input as any).prompt || 'unknown'}`
  }
}

class WorldAgent extends BaseAgent {
  readonly agentType = 'world' as const
  
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    // 模拟执行：返回包含输入提示词的输出
    return {
      content: `WorldAgent output for: ${(input as any).prompt || 'unknown'}`,
      tokensUsed: 150
    }
  }
  
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    yield `WorldAgent stream output for: ${(input as any).prompt || 'unknown'}`
  }
}

// ==================== 模拟上下文 ===================

const mockContext: AgentContext = {
  project: {
    id: 'test-project',
    name: 'Test Project',
    volumes: [],
    characters: [],
    worldSettings: null,
    storyState: null
  } as any,
  config: {
    activeModelId: 'test-model',
    models: [],
    agentModelMapping: {}
  } as any,
  mountedSkills: []
}

// ==================== 测试套件 ===================

describe('Agent 协作集成测试', () => {
  let orchestrator: AgentOrchestrator
  
  beforeEach(() => {
    // 重置单例
    AgentOrchestrator.resetInstance()
    orchestrator = AgentOrchestrator.getInstance()
  })
  
  afterEach(() => {
    // 销毁编排器
    orchestrator.destroy()
    AgentOrchestrator.resetInstance()
  })
  
  // ==================== Pipeline 执行测试 ===================
  
  describe('Pipeline 执行', () => {
    test('应该成功执行 Pipeline（IdeaAgent -> WorldAgent）', async () => {
      // 注册 Agent
      const ideaAgent = new IdeaAgent()
      const worldAgent = new WorldAgent()
      
      orchestrator.registerAgent(ideaAgent)
      orchestrator.registerAgent(worldAgent)
      
      // 创建 Pipeline
      const pipeline = {
        id: 'test-pipeline',
        name: 'Idea -> World Pipeline',
        steps: [
          {
            id: 'step1',
            agentType: 'idea' as const,
            inputTransformer: (output: any, originalInput: any) => ({
              type: 'world',
              prompt: output.content
            })
          },
          {
            id: 'step2',
            agentType: 'world' as const
          }
        ]
      }
      
      // 执行 Pipeline
      const input: AgentInput = { type: 'idea', prompt: 'Test idea prompt' }
      const outputs = await orchestrator.executePipeline(pipeline, mockContext, input)
      
      // 验证结果
      expect(outputs.length).toBe(2)
      expect(outputs[0].content).toContain('IdeaAgent output')
      expect(outputs[1].content).toContain('WorldAgent output')
    })
  })
  
  // ==================== 记忆共享测试 ===================
  
  describe('记忆共享', () => {
    test('应该成功保存和获取 Agent 记忆', async () => {
      // 注册 Agent
      const ideaAgent = new IdeaAgent()
      orchestrator.registerAgent(ideaAgent)
      
      // 执行 Agent（应该自动保存记忆）
      const input: AgentInput = { type: 'idea', prompt: 'Test prompt' }
      await orchestrator.executeSingle(input, mockContext)
      
      // 获取记忆
      const memories = orchestrator.getAgentMemories('idea')
      
      // 验证记忆已保存
      expect(memories.length).toBeGreaterThan(0)
      expect(memories[0].content).toContain('IdeaAgent output')
    })
  })
  
  // ==================== 消息传递测试 ===================
  
  describe('消息传递', () => {
    test('应该成功在 Agent 之间传递消息', async () => {
      // 注册 Agent
      const ideaAgent = new IdeaAgent()
      const worldAgent = new WorldAgent()
      
      orchestrator.registerAgent(ideaAgent)
      orchestrator.registerAgent(worldAgent)
      
      // 订阅消息
      let receivedMessage: any = null
      orchestrator.subscribeMessages('world', (message: any) => {
        receivedMessage = message
      })
      
      // 发送消息
      await orchestrator.sendMessage({
        id: 'msg-1',
        from: 'idea',
        to: 'world',
        type: 'data',
        payload: { test: 'data' },
        timestamp: Date.now()
      })
      
      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 验证消息已接收
      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage.from).toBe('idea')
      expect(receivedMessage.to).toBe('world')
    })
  })
})
