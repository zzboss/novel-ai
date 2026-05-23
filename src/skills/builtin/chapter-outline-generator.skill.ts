/**
 * 章节大纲生成器 Skill
 * 功能：根据项目信息和用户输入生成章节大纲
 * 适用于：chapter
 * 
 * 注意：此 Skill 应集成 RAG，从项目记忆中检索相关信息
 */

export const manifest = {
  id: 'chapter-outline-generator',
  name: '章节大纲生成器',
  version: '1.0.0',
  description: '根据项目信息和用户输入生成章节大纲',
  author: 'AIWT Team',
  applicableAgents: ['chapter'],
  entry: '@/skills/builtin/chapter-outline-generator.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  project: any
  chapterTitle: string
  previousOutline?: string
  context?: string
  llmClient?: any
  ragRetriever?: any
}): Promise<string> {
  console.log('[ChapterOutlineGeneratorSkill] 生成章节大纲:', params.chapterTitle)
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法生成大纲。请确保已配置 LLM。`
  }
  
  // 尝试使用 RAG 检索相关信息
  let ragContext = ''
  if (params.ragRetriever) {
    try {
      const query = `章节：${params.chapterTitle}\n${params.previousOutline || ''}`
      const results = await params.ragRetriever.retrieve(query, { topK: 5 })
      
      if (results && results.length > 0) {
        ragContext = '\n\n## 相关记忆\n'
        results.forEach((result: any, index: number) => {
          ragContext += `\n### 记忆 ${index + 1}\n${result.content}\n`
        })
      }
    } catch (error) {
      console.error('[ChapterOutlineGeneratorSkill] RAG 检索失败:', error)
    }
  }
  
  // 构建生成提示
  const prompt = `# 章节大纲生成任务\n\n请为以下章节生成详细大纲：\n\n## 章节标题\n${params.chapterTitle}\n\n## 项目信息\n${JSON.stringify(params.project, null, 2)}\n\n## 前文大纲（如有）\n${params.previousOutline || '无'}${ragContext}\n\n## 要求\n1. 生成章节的详细大纲（包括场景、事件、转折点）\n2. 大纲应服务于整体故事弧线\n3. 包含关键对话和情节点\n4. 注意节奏和张力控制\n5. 格式清晰，易于后续扩展为正文\n\n请生成大纲：`
  
  try {
    // 调用 LLM 生成大纲
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.7
    })
    
    return `# 章节大纲：${params.chapterTitle}\n\n${result}\n\n---\n生成时间：${new Date().toLocaleString()}`
  } catch (error) {
    console.error('[ChapterOutlineGeneratorSkill] 生成大纲失败:', error)
    return `生成大纲失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
