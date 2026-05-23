# Agent 编排器使用文档

## 简介

Agent 编排器（AgentOrchestrator）是 Phase 3 的核心组件，用于管理多个 Agent 的注册、执行、协作和记忆共享。

### 核心功能

1. **Agent 注册管理**：统一管理所有 Agent 的注册和注销
2. **Agent 执行调度**：支持单个执行、并行执行和 Pipeline 执行
3. **Agent 协作协调**：通过消息传递机制实现 Agent 间协作
4. **Agent 记忆共享**：所有 Agent 通过 Chroma 向量数据库共享记忆

## 快速开始

### 1. 获取编排器实例

```typescript
import { AgentOrchestrator } from '@/agents/orchestrator'

// 获取单例实例
const orchestrator = AgentOrchestrator.getInstance()

// 或者，在创建时传入配置
const orchestrator = AgentOrchestrator.getInstance({
  enableParallelExecution: true,
  maxParallelism: 3,
  enableMemorySharing: true
})
```

### 2. 注册 Agent

```typescript
import { ChapterAgent } from '@/agents/ChapterAgent'
import { ConsistencyAgent } from '@/agents/ConsistencyAgent'

// 注册单个 Agent
orchestrator.registerAgent(new ChapterAgent())

// 批量注册 Agent
orchestrator.registerAgents([
  new ChapterAgent(),
  new ConsistencyAgent(),
  new AntiAIAgent()
])
```

### 3. 执行 Agent

#### 单个执行

```typescript
const input = {
  type: 'chapter',
  chapterId: 'chapter-1',
  outline: '主角进入神秘森林'
}

const context = {
  project: projectState,
  config: settingsState,
  mountedSkills: []
}

const output = await orchestrator.executeSingle(input, context)
console.log(output.content)
```

#### 并行执行

```typescript
const inputs = [
  { type: 'consistency', chapterId: 'chapter-1', fullText: '...' },
  { type: 'anti_ai', content: '...', level: 2 }
]

const results = await orchestrator.executeParallel(inputs, context)

for (const result of results) {
  if (result.success) {
    console.log('成功:', result.output?.content)
  } else {
    console.error('失败:', result.error)
  }
}
```

#### Pipeline 执行

```typescript
const pipeline = {
  id: 'quality-check-pipeline',
  name: '质量检查流水线',
  steps: [
    {
      id: 'step1',
      agentType: 'chapter',
      inputTransformer: (output, originalInput) => ({
        type: 'consistency',
        chapterId: originalInput.chapterId,
        fullText: output.content
      })
    },
    {
      id: 'step2',
      agentType: 'consistency'
    }
  ],
  onStepError: 'stop',
  maxRetries: 3
}

const outputs = await orchestrator.executePipeline(pipeline, context, initialInput)
```

## 高级功能

### 1. 消息传递

Agent 间可以通过消息传递进行异步通信。

#### 发送消息

```typescript
await orchestrator.sendMessage({
  id: 'msg-1',
  from: 'chapter',
  to: 'consistency',
  type: 'data',
  payload: { chapterId: 'chapter-1', content: '...' },
  timestamp: Date.now()
})
```

#### 订阅消息

```typescript
orchestrator.subscribeMessages('consistency', async (message) => {
  console.log('收到消息:', message)
  
  // 处理消息
  if (message.type === 'data') {
    const result = await doSomething(message.payload)
    
    // 发送响应
    await orchestrator.sendMessage({
      id: 'msg-2',
      from: 'consistency',
      to: message.from,
      type: 'response',
      correlationId: message.id,
      payload: { result },
      timestamp: Date.now()
    })
  }
})
```

### 2. 记忆共享

所有 Agent 可以通过 Chroma 向量数据库共享记忆。

#### 保存记忆

```typescript
// 需要先设置 MemoryManager 和 EmbeddingClient
orchestrator.setMemoryManager(memoryManager)
orchestrator.setEmbeddingClient(embeddingClient)
orchestrator.setCurrentProject('project-1')

// 保存 Agent 记忆
await orchestrator.saveAgentMemory('chapter', '这是章节内容...', {
  chapterId: 'chapter-1',
  wordCount: 3000
})
```

#### 获取记忆

```typescript
// 获取指定 Agent 的记忆
const memories = orchestrator.getAgentMemories('chapter', 10)

// 获取所有 Agent 的记忆
const allMemories = orchestrator.getAgentMemories(undefined, 100)
```

#### 搜索记忆

```typescript
// 需要先设置 MemoryManager
const results = await orchestrator.searchAgentMemories('主角进入森林', {
  agentType: 'chapter',
  maxResults: 5
})
```

### 3. 与 BaseAgent 集成

BaseAgent 已经集成了 RAG 检索功能，所有继承自 BaseAgent 的 Agent 都自动获得 RAG 能力。

#### 设置 RAG 检索器

```typescript
import { RAGRetriever } from '@/memory/RAGRetriever'

// 创建 RAG 检索器
const ragRetriever = new RAGRetriever(
  memoryManager,
  chromaManager,
  embeddingClient,
  db
)

await ragRetriever.initialize()

// 设置到 Agent
const agent = new ChapterAgent()
agent.setRAGRetriever(ragRetriever)
```

#### 在 Agent 中检索记忆

```typescript
class MyAgent extends BaseAgent {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    // 构建上下文（自动集成 RAG 检索）
    const ctx = await this.buildContext(input, context)
    
    // ctx 已经包含了相关的记忆
    const response = await this.callLLM([{ role: 'user', content: ctx }], context)
    
    return { content: response }
  }
}
```

## Pinia Store 使用

项目提供了 `useAgentOrchestratorStore` Pinia store，用于在 Vue 组件中使用 Agent 编排器。

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { useAgentOrchestratorStore } from '@/stores/agent/orchestrator'

const orchestratorStore = useAgentOrchestratorStore()

// 注册 Agent
orchestratorStore.registerAgent(new ChapterAgent())

// 执行 Agent
const result = await orchestratorStore.executeSingle(input, context)

// 监听执行状态
watch(() => orchestratorStore.isExecuting, (value) => {
  console.log('执行状态:', value)
})

// 获取执行日志
const logs = computed(() => orchestratorStore.executionLogs)
</script>
```

## UI 组件

项目提供了以下 UI 组件：

1. **AgentOrchestratorPanel.vue**：Agent 编排面板，展示 Agent 协作状态
2. **AgentExecutionStatus.vue**：Agent 执行状态组件，展示执行进度和结果
3. **AgentMemoryViewer.vue**：Agent 记忆查看器，展示和管理 Agent 共享记忆

### 在 Workbench 中使用

AgentOrchestratorPanel 已经集成到 Workbench 右侧面板，点击顶部工具栏的"Agent 协作"按钮即可打开。

## API 参考

### AgentOrchestrator 类

#### 静态方法

| 方法 | 说明 |
|------|------|
| `getInstance(config?)` | 获取编排器单例 |
| `resetInstance()` | 重置单例（主要用于测试） |

#### 实例方法

| 方法 | 说明 |
|------|------|
| `registerAgent(agent)` | 注册 Agent |
| `unregisterAgent(agentType)` | 注销 Agent |
| `getAgent(agentType)` | 获取已注册的 Agent |
| `getRegisteredAgentTypes()` | 获取所有已注册的 Agent 类型 |
| `isAgentRegistered(agentType)` | 检查 Agent 是否已注册 |
| `registerAgents(agents)` | 批量注册 Agent |
| `executeSingle(input, context, agentType?)` | 执行单个 Agent |
| `executeStream(input, context, agentType?)` | 流式执行单个 Agent |
| `executeParallel(inputs, context, agentTypes?)` | 并行执行多个 Agent |
| `executePipeline(pipeline, context, initialInput)` | 执行 Agent 流水线 |
| `sendMessage(message)` | 发送消息 |
| `subscribeMessages(agentType, handler)` | 订阅消息 |
| `unsubscribeMessages(agentType, handler)` | 取消订阅消息 |
| `saveAgentMemory(agentType, content, metadata?)` | 保存 Agent 记忆 |
| `getAgentMemories(agentType?, limit?)` | 获取 Agent 记忆 |
| `clearAgentMemories(agentType?)` | 清除 Agent 记忆 |
| `searchAgentMemories(query, options?)` | 搜索 Agent 记忆 |
| `setMemoryManager(manager)` | 设置 MemoryManager |
| `setEmbeddingClient(client)` | 设置 EmbeddingClient |
| `setCurrentProject(projectId)` | 设置当前项目 ID |
| `getExecutionRecord(executionId)` | 获取执行记录 |
| `getAllExecutionRecords()` | 获取所有执行记录 |
| `clearExecutionRecords()` | 清除执行记录 |
| `updateConfig(config)` | 更新配置 |
| `getConfig()` | 获取当前配置 |
| `destroy()` | 销毁编排器 |

### 配置选项

```typescript
interface AgentOrchestratorConfig {
  /** 是否启用并行执行 */
  enableParallelExecution: boolean
  
  /** 并行执行最大并发数 */
  maxParallelism: number
  
  /** 是否启用 Agent 记忆共享 */
  enableMemorySharing: boolean
  
  /** 是否启用 Agent 消息传递 */
  enableMessagePassing: boolean
  
  /** 默认超时时间（毫秒） */
  defaultTimeout: number
  
  /** 是否启用执行日志 */
  enableExecutionLog: boolean
}
```

## 常见问题

### 1. 如何启用记忆共享？

需要设置 `MemoryManager` 和 `EmbeddingClient`：

```typescript
orchestrator.setMemoryManager(memoryManager)
orchestrator.setEmbeddingClient(embeddingClient)
orchestrator.setCurrentProject('project-1')
```

### 2. 如何启用 RAG 检索？

需要在 Agent 中设置 `RAGRetriever`：

```typescript
const agent = new ChapterAgent()
agent.setRAGRetriever(ragRetriever)
```

### 3. 如何创建自定义 Agent？

继承 `BaseAgent` 并实现 `execute()` 和 `stream()` 方法：

```typescript
export class MyAgent extends BaseAgent {
  readonly agentType = 'my_agent' as const
  
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const response = await this.callLLM([{ role: 'user', content: ctx }], context)
    return { content: response }
  }
  
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const ctx = await this.buildContext(input, context)
    yield* this.callLLMStream([{ role: 'user', content: ctx }], context)
  }
}
```

## 总结

Agent 编排器是 Phase 3 的核心组件，提供了强大的 Agent 管理和协作能力。通过本文档，您应该能够：

1. 注册和执行 Agent
2. 实现 Agent 间协作
3. 共享 Agent 记忆
4. 集成 RAG 检索
5. 在 Vue 组件中使用编排器

如有任何问题，请参考源代码或联系开发团队。
