/**
 * 情节漏洞检测器 Skill
 * 功能：检测情节漏洞（plot holes），如逻辑矛盾、时间线错误、角色行为不一致等
 * 适用于：chapter, continue, polish
 * 
 * 注意：此 Skill 应集成 RAG，从项目记忆中检索相关情节信息
 */

export const manifest = {
  id: 'plot-hole-detector',
  name: '情节漏洞检测器',
  version: '1.0.0',
  description: '检测情节漏洞（plot holes），如逻辑矛盾、时间线错误、角色行为不一致等',
  author: 'AIWT Team',
  applicableAgents: ['chapter', 'continue', 'polish'],
  entry: '@/skills/builtin/plot-hole-detector.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  project: any
  chapterContent?: string
  storyOutline?: string
  context?: string
  llmClient?: any
  ragRetriever?: any
}): Promise<string> {
  console.log('[PlotHoleDetectorSkill] 检测情节漏洞')
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法检测情节漏洞。请确保已配置 LLM。`
  }
  
  // 尝试使用 RAG 检索相关信息
  let ragContext = ''
  if (params.ragRetriever) {
    try {
      const query = `情节漏洞检测：${params.chapterContent?.substring(0, 200) || params.storyOutline?.substring(0, 200) || ''}`
      const results = await params.ragRetriever.retrieve(query, { topK: 5 })
      
      if (results && results.length > 0) {
        ragContext = '\n\n## 相关记忆\n'
        results.forEach((result: any, index: number) => {
          ragContext += `\n### 记忆 ${index + 1}\n${result.content}\n`
        })
      }
    } catch (error) {
      console.error('[PlotHoleDetectorSkill] RAG 检索失败:', error)
    }
  }
  
  // 构建检测提示
  const prompt = `# 情节漏洞检测任务\n\n请检测以下内容的情节漏洞：\n\n## 章节内容\n${params.chapterContent || '无'}\n\n## 故事大纲\n${params.storyOutline || '无'}\n\n## 项目信息\n${JSON.stringify(params.project, null, 2)}${ragContext}\n\n## 要求\n1. 检测逻辑矛盾（如角色行为不一致、事件前后矛盾）\n2. 检测时间线错误（如时间顺序混乱、时间跳跃不合理）\n3. 检测角色行为不一致（如角色性格突变、动机不明）\n4. 检测设定漏洞（如世界观设定前后不一致）\n5. 按严重程度排序（严重、中等、轻微）\n6. 为每个漏洞提供修复建议\n\n请生成检测报告：`
  
  try {
    // 调用 LLM 检测情节漏洞
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 3000,
      temperature: 0.5 // 较低温度，保持准确性
    })
    
    return `# 情节漏洞检测报告\n\n${result}\n\n---\n检测时间：${new Date().toLocaleString()}`
  } catch (error) {
    console.error('[PlotHoleDetectorSkill] 检测情节漏洞失败:', error)
    return `检测情节漏洞失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
