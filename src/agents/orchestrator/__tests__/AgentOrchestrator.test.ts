/**
 * AgentOrchestrator 单元测试
 * 
 * 测试内容：
 * - Agent 注册
 * - 单个 Agent 执行
 * - 并行执行
 * - Pipeline 执行
 * - 消息传递
 * - 记忆共享
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { AgentOrchestrator } from '../AgentOrchestrator'
import { BaseAgent } from '../base'
import type { AgentInput, AgentOutput, AgentContext } from '../types'

// ==================== 模拟 Agent ====================

class MockAgent extends BaseAgent {
  readonly agentType = 'idea' as const
  
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return {
      content: `Mock output for ${input.type}`,
      tokensUsed: 100
    }
  }
  
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    yield `Mock stream output for ${input.type}`
  }
}

class MockAgent2 extends BaseAgent {
  readonly agentType = 'world' as const
  
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return {
      content: `Mock agent2 output for ${input.type}`,
      tokensUsed: 150
    }
  }
  
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    yield `Mock agent2 stream output for ${input.type}`
  }
}

// ==================== 模拟上下文 ====================

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

// ==================== 测试套件 ====================

describe('AgentOrchestrator', () => {
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
  
  // ==================== Agent 注册测试 ====================
  
  describe('Agent 注册', () => {
    test('应该成功注册 Agent', () => {
      const agent = new MockAgent()
      orchestrator.registerAgent(agent)
      
      expect(orchestrator.isAgentRegistered('idea')).toBe(true)
      expect(orchestrator.getRegisteredAgentTypes()).toContain('idea')
    })
    
    test('应该成功注销 Agent', () => {
      const agent = new MockAgent()
      orchestrator.registerAgent(agent)
      expect(orchestrator.isAgentRegistered('idea')).toBe(true)
      
      orchestrator.unregisterAgent('idea')
      expect(orchestrator.isAgentRegistered('idea')).toBe(false)
    })
    
    test('注册相同类型 Agent 应该覆盖', () => {
      const agent1 = new MockAgent()
      const agent2 = new MockAgent()
      
      orchestrator.registerAgent(agent1)
      expect(orchestrator.getRegisteredAgentTypes()).toContain('idea')
      
      // 注册相同类型（应该覆盖）
      orchestrator.registerAgent(agent2)
      expect(orchestrator.getRegisteredAgentTypes()).toContain('idea')
    })
  })
  
  // ==================== 单个 Agent 执行测试 ====================
  
  describe('单个 Agent 执行', () => {
    test('应该成功执行已注册的 Agent', async () => {
      const agent = new MockAgent()
      orchestrator.registerAgent(agent)
      
      const input: AgentInput = { type: 'idea', prompt: 'Test prompt' }
      const output = await orchestrator.executeSingle(input, mockContext)
      
      expect(output.content).toContain('Mock output')
      expect(output.tokensUsed).toBe(100)
    })
    
    test('执行未注册的 Agent 应该抛出错误', async () => {
      const input: AgentInput = { type: 'idea', prompt: 'Test prompt' }
      
      await expect(orchestrator.executeSingle(input, mockContext))
        .rejects.toThrow('未注册')
    })
  })
  
  // ==================== 并行执行测试 ====================
  
  describe('并行执行', () => {
    test('应该成功并行执行多个 Agent', async () => {
      const agent1 = new MockAgent()
      const agent2 = new MockAgent2()
      
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
      
      const inputs: AgentInput[] = [
        { type: 'idea', prompt: 'Test prompt 1' },
        { type: 'world', prompt: 'Test prompt 2' }
      ]
      
      const results = await orchestrator.executeParallel(inputs, mockContext)
      
      expect(results.length).toBe(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })
  })
  
  // ==================== Pipeline 执行测试 ====================
  
  describe('Pipeline 执行', () => {
    test('应该成功执行 Pipeline', async () => {
      const agent = new MockAgent()
      orchestrator.registerAgent(agent)
      
      const pipeline = {
        id: 'test-pipeline',
        name: 'Test Pipeline',
        steps: [
          {
            id: 'step1',
            agentType: 'idea' as const,
            inputTransformer: (output: any, originalInput: any) => originalInput
          }
        ]
      }
      
      const input: AgentInput = { type: 'idea', prompt: 'Test prompt' }
      const outputs = await orchestrator.executePipeline(pipeline, mockContext, input)
      
      expect(outputs.length).toBe(1)
      expect(outputs[0].content).toContain('Mock output')
    })
  })
  
  // ==================== 消息传递测试 ====================
  
  describe('消息传递', () => {
    test('应该成功发送和接收消息', async () => {
      let receivedMessage: any = null
      
      // 订阅消息
      orchestrator.subscribeMessages('idea', (message: any) => {
        receivedMessage = message
      })
      
      // 发送消息
      await orchestrator.sendMessage({
        id: 'msg-1',
        from: 'world',
        to: 'idea',
        type: 'data',
        payload: { test: 'data' },
        timestamp: Date.now()
      })
      
      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage.from).toBe('world')
      expect(receivedMessage.to).toBe('idea')
    })
  })
  
  // ==================== 记忆共享测试 ====================
  
  describe('记忆共享', () => {
    test('应该成功保存和获取记忆', async () => {
      // 保存记忆
      await orchestrator.saveAgentMemory('idea', 'Test memory content', {
        test: true
      })
      
      // 获取记忆
      const memories = orchestrator.getAgentMemories('idea')
      
      expect(memories.length).toBeGreaterThan(0)
      expect(memories[0].content).toBe('Test memory content')
      expect(memories[0].sourceAgent).toBe('idea')
    })
    
    test('应该成功清除记忆', async () => {
      // 保存记忆
      await orchestrator.saveAgentMemory('idea', 'Test memory content')
      
      // 清除记忆
      orchestrator.clearAgentMemories('idea')
      
      // 获取记忆
      const memories = orchestrator.getAgentMemories('idea')
      
      expect(memories.length).toBe(0)
    })
  })
})
