# Skill 系统使用文档

## 概述

Skill 系统是 AIWT Novel-AI 项目的核心扩展机制，允许用户和开发者扩展 AI 助手的功能。通过 Skill，可以为 Agent 添加各种能力，如联网搜索、参考资料查找、文风迁移、类型规则注入、翻译等。

## 系统架构

Skill 系统由以下几个核心组件组成：

1. **SkillLoader**：负责从文件系统加载 Skill 包（读取 manifest.json）
2. **SkillRegistry**：负责 Skill 的注册、卸载和生命周期管理
3. **SkillHotReloader**：负责监听 Skill 文件变化并自动重新加载
4. **SkillDependencyManager**：负责解析依赖关系、检测循环依赖
5. **Skill Store**：Pinia Store，管理 Skill 的 UI 状态

## 内置 Skill

系统自带 10 个内置 Skill（5 个工具型 + 5 个创作型）：

### 工具型 Skill

1. **web-search（联网搜索）**
   - 功能：通过互联网搜索获取实时信息
   - 适用 Agent：全部
   - 需要工具调用权限：是

2. **reference-lookup（参考资料查找）**
   - 功能：在指定参考资料中检索相关内容
   - 适用 Agent：chapter, continue, polish
   - 需要工具调用权限：否

3. **style-transfer（文风迁移）**
   - 功能：将文本改写为指定作者的文风
   - 适用 Agent：polish
   - 需要工具调用权限：否

4. **genre-rules（类型规则注入）**
   - 功能：注入特定类型的写作规则和套路
   - 适用 Agent：outline, chapter, continue
   - 需要工具调用权限：否

5. **translation（翻译）**
   - 功能：将文本翻译为指定语言
   - 适用 Agent：polish
   - 需要工具调用权限：否

### 创作型 Skill

1. **chapter-outline-generator（章节大纲生成器）**
   - 功能：根据项目信息和用户输入生成章节大纲
   - 适用 Agent：chapter
   - 需要工具调用权限：否

2. **character-depth-analyzer（角色深度分析器）**
   - 功能：分析角色的深度，包括性格、动机、成长弧线等
   - 适用 Agent：chapter, continue, polish
   - 需要工具调用权限：否

3. **plot-hole-detector（情节漏洞检测器）**
   - 功能：检测情节漏洞（plot holes），如逻辑矛盾、时间线错误、角色行为不一致等
   - 适用 Agent：chapter, continue, polish
   - 需要工具调用权限：否

4. **dialogue-polish（对话润色器）**
   - 功能：润色对话，使其更自然、更符合角色性格
   - 适用 Agent：polish
   - 需要工具调用权限：否

5. **world-building-assistant（世界观构建助手）**
   - 功能：辅助世界观构建，包括地理、历史、文化、魔法系统等
   - 适用 Agent：outline, chapter, continue
   - 需要工具调用权限：否

## 使用指南

### 1. 加载内置 Skill

1. 打开 AI 助手面板（右侧）
2. 点击 "📦 Skill管理" 按钮
3. 在 Skill 管理面板中，点击 "加载内置 Skill" 按钮
4. 系统将自动加载所有内置 Skill

### 2. 启用/禁用 Skill

1. 打开 Skill 管理面板
2. 在 Skill 列表中找到要启用/禁用的 Skill
3. 点击右侧的开关按钮

### 3. 查看 Skill 详情

1. 打开 Skill 管理面板
2. 在 Skill 列表中找到要查看的 Skill
3. 点击 "详情" 按钮
4. 在弹出的对话框中查看 Skill 详细信息

### 4. 卸载 Skill

1. 打开 Skill 管理面板
2. 在 Skill 列表中找到要卸载的 Skill
3. 点击 "卸载" 按钮
4. 在确认对话框中点击 "确定"

### 5. 导入第三方 Skill

> **注意**：此功能正在开发中。

1. 打开 Skill 管理面板
2. 点击 "导入 Skill" 按钮
3. 选择 Skill 目录（包含 manifest.json 文件）
4. 系统将自动加载并注册 Skill

### 6. 清除缓存

1. 打开 Skill 管理面板
2. 点击 "清除缓存" 按钮
3. 系统将清除所有 Skill 缓存

## 创建自定义 Skill

### Skill 文件结构

一个完整的 Skill 包应包含以下文件：

```
my-skill/
├── manifest.json       # Skill 清单（必需）
├── my-skill.skill.ts  # Skill 执行逻辑（必需）
└── README.md          # Skill 说明文档（可选）
```

### manifest.json 格式

```json
{
  "id": "my-skill",
  "name": "我的 Skill",
  "version": "1.0.0",
  "description": "Skill 功能描述",
  "author": "作者名称",
  "applicableAgents": ["chapter", "polish"],
  "entry": "./my-skill.skill.ts",
  "requiresToolCall": false,
  "dependencies": [
    {
      "skillId": "other-skill",
      "versionRange": ">=1.0.0"
    }
  ]
}
```

字段说明：

- `id`：Skill 唯一标识符（必需）
- `name`：Skill 显示名称（必需）
- `version`：版本号（语义化版本，必需）
- `description`：功能描述（必需）
- `author`：作者信息（必需）
- `applicableAgents`：适用的 Agent 类型列表（空数组表示全部适用）
- `entry`：Skill 入口文件相对路径（必需）
- `requiresToolCall`：是否需要工具调用权限（默认 false）
- `dependencies`：依赖的 Skill 列表（可选）

### Skill 执行逻辑文件格式

```typescript
/**
 * 我的 Skill
 * 功能：Skill 功能描述
 * 适用于：chapter, polish
 */

export const manifest = {
  id: 'my-skill',
  name: '我的 Skill',
  version: '1.0.0',
  description: 'Skill 功能描述',
  author: '作者名称',
  applicableAgents: ['chapter', 'polish'],
  entry: '@/skills/builtin/my-skill.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  // 定义参数
  param1: string
  param2?: number
  // 可以接受 context（执行上下文）
  context?: string
  // 可以接受 llmClient（LLM 客户端）
  llmClient?: any
  // 可以接受 ragRetriever（RAG 检索器）
  ragRetriever?: any
}): Promise<string> {
  console.log('[MySkill] 执行:', params.param1)
  
  // 实现 Skill 逻辑
  // 可以调用 LLM
  // 可以调用 RAG 检索器
  // 可以访问项目状态
  
  // 返回执行结果
  return `执行结果：${params.param1}`
}

export default { manifest, execute }
```

### 参数说明

Skill 的 `execute()` 函数可以接受以下参数：

1. **自定义参数**：根据 Skill 功能定义的参数
2. **context**：执行上下文（可选）
3. **llmClient**：LLM 客户端（可选，用于调用大模型）
4. **ragRetriever**：RAG 检索器（可选，用于检索相关记忆）

### 返回值

Skill 的 `execute()` 函数应返回 `Promise<string>`，即执行结果的文本。

## 管理 Skill

### 使用 Skill 管理面板

Skill 管理面板提供了友好的 UI，用于管理 Skill：

1. **加载内置 Skill**：一键加载所有内置 Skill
2. **导入 Skill**：从文件系统导入第三方 Skill
3. **启用/禁用 Skill**：通过开关按钮控制 Skill 状态
4. **查看详情**：查看 Skill 的详细信息
5. **卸载 Skill**：从系统中移除 Skill
6. **清除缓存**：清除 Skill 加载器缓存

### 使用 API

你也可以通过代码管理 Skill：

```typescript
import { SkillRegistry } from '@/skills/SkillRegistry'
import { SkillLoader } from '@/skills/SkillLoader'
import { useSkillStore } from '@/stores/skill'

// 获取注册中心实例
const registry = SkillRegistry.getInstance()

// 加载内置 Skill
const builtin = SkillLoader.loadBuiltinSkills()
builtin.forEach(manifest => {
  registry.register(manifest)
})

// 注册 Skill
registry.register(manifest)

// 卸载 Skill
registry.unregister('skill-id')

// 获取已注册的 Skill
const registered = registry.getRegistered()

// 获取适用于某 Agent 的 Skill
const applicable = registry.getApplicable('chapter')

// 执行 Skill
const result = await registry.execute('skill-id', context)

// 使用 Store
const store = useSkillStore()
store.loadBuiltinSkills()
store.executeSkill('skill-id', context)
```

## 依赖管理

Skill 系统支持依赖管理，允许 Skill 声明它依赖的其他 Skill。

### 声明依赖

在 `manifest.json` 中声明依赖：

```json
{
  "id": "my-skill",
  "dependencies": [
    {
      "skillId": "base-skill",
      "versionRange": ">=1.0.0"
    }
  ]
}
```

### 检测循环依赖

SkillDependencyManager 可以检测循环依赖：

```typescript
import { SkillDependencyManager } from '@/skills/SkillDependencyManager'

const manager = new SkillDependencyManager()
manager.addSkill(manifest1)
manager.addSkill(manifest2)

const hasCycle = manager.detectCycle()
if (hasCycle) {
  console.error('检测到循环依赖:', manager.getCyclePath())
}
```

### 获取加载顺序

SkillDependencyManager 可以按依赖顺序排序 Skill：

```typescript
const loadOrder = manager.getLoadOrder()
console.log('加载顺序:', loadOrder)
```

## 热重载

Skill 系统支持热重载，当 Skill 文件发生变化时，会自动重新加载。

### 启用热重载

```typescript
import { SkillHotReloader } from '@/skills/SkillHotReloader'

const reloader = new SkillHotReloader()

// 开始监听
reloader.watch('/path/to/skills')

// 监听变化事件
reloader.onChange((skillId, eventType) => {
  console.log(`Skill ${skillId} ${eventType}`)
})

// 停止监听
reloader.stop()
```

### 手动重新加载

```typescript
// 手动重新加载
await reloader.reload('/path/to/skill')
```

## 最佳实践

1. **声明清晰的依赖**：在 `manifest.json` 中清晰声明 Skill 的依赖
2. **处理错误**：在 `execute()` 函数中正确处理错误
3. **使用 RAG**：创作型 Skill 应集成 RAG，从项目记忆中检索相关信息
4. **调用 LLM**：需要生成内容的 Skill 应调用 LLM 客户端
5. **返回清晰的结果**：`execute()` 函数应返回清晰、格式化的结果
6. **提供详细的描述**：在 `manifest.json` 中提供详细的功能描述
7. **版本管理**：使用语义化版本管理 Skill 版本

## 常见问题

### 1. 如何调试 Skill？

在 Skill 的 `execute()` 函数中使用 `console.log()` 打印调试信息，然后在开发者工具中查看日志。

### 2. 如何测试 Skill？

使用 Vitest 编写单元测试：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { execute } from './my-skill.skill'

describe('my-skill', () => {
  it('应该成功执行', async () => {
    const result = await execute({
      param1: 'test',
      llmClient: {
        generateText: vi.fn().mockResolvedValue('result')
      }
    })
    
    expect(result).toContain('执行结果')
  })
})
```

### 3. 如何分发 Skill？

将 Skill 包（包含 manifest.json 和 .skill.ts 文件）打包为 ZIP，然后分享给其他用户。其他用户可以通过 "导入 Skill" 功能安装。

## 总结

Skill 系统是 AIWT Novel-AI 项目的核心扩展机制，通过 Skill，可以为 Agent 添加各种能力。本文档介绍了 Skill 系统的架构、内置 Skill、使用指南、创建自定义 Skill 的方法、管理 Skill 的方法、依赖管理、热重载以及最佳实践。

如有任何问题或建议，请通过 GitHub Issues 联系我们。
