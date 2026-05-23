/**
 * 世界观构建助手 Skill
 * 功能：辅助世界观构建，包括地理、历史、文化、魔法系统等
 * 适用于：outline, chapter, continue
 * 
 * 注意：此 Skill 应集成 RAG，从项目记忆中检索世界观相关信息
 */

export const manifest = {
  id: 'world-building-assistant',
  name: '世界观构建助手',
  version: '1.0.0',
  description: '辅助世界观构建，包括地理、历史、文化、魔法系统等',
  author: 'AIWT Team',
  applicableAgents: ['outline', 'chapter', 'continue'],
  entry: '@/skills/builtin/world-building-assistant.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  project: any
  aspect: string
  existingWorldBuilding?: string
  context?: string
  llmClient?: any
  ragRetriever?: any
}): Promise<string> {
  console.log('[WorldBuildingAssistantSkill] 构建世界观:', params.aspect)
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法构建世界观。请确保已配置 LLM。`
  }
  
  // 尝试使用 RAG 检索相关信息
  let ragContext = ''
  if (params.ragRetriever) {
    try {
      const query = `世界观：${params.aspect}\n${params.existingWorldBuilding || ''}`
      const results = await params.ragRetriever.retrieve(query, { topK: 5 })
      
      if (results && results.length > 0) {
        ragContext = '\n\n## 相关记忆\n'
        results.forEach((result: any, index: number) => {
          ragContext += `\n### 记忆 ${index + 1}\n${result.content}\n`
        })
      }
    } catch (error) {
      console.error('[WorldBuildingAssistantSkill] RAG 检索失败:', error)
    }
  }
  
  // 构建世界观构建提示
  const prompt = `# 世界观构建任务\n\n请为以下方面构建详细的世界观：\n\n## 构建方面\n${params.aspect}\n\n## 现有世界观（如有）\n${params.existingWorldBuilding || '无'}\n\n## 项目信息\n${JSON.stringify(params.project, null, 2)}${ragContext}\n\n## 要求\n1. 构建详细、自洽的世界观\n2. 注意逻辑性和一致性\n3. 考虑对世界的影响（如地理影响文化、历史影响现状）\n4. 提供具体细节（如地名、历史事件、文化习俗）\n5. 格式清晰，易于扩展到其他方面\n\n请提供世界观构建内容：`
  
  try {
    // 调用 LLM 构建世界观
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 3000,
      temperature: 0.8 // 较高温度，鼓励创造性
    })
    
    return `# 世界观构建：${params.aspect}\n\n${result}\n\n---\n构建时间：${new Date().toLocaleString()}`
  } catch (error) {
    console.error('[WorldBuildingAssistantSkill] 构建世界观失败:', error)
    return `构建世界观失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
