/**
 * 角色深度分析器 Skill
 * 功能：分析角色的深度，包括性格、动机、成长弧线等
 * 适用于：chapter, continue, polish
 * 
 * 注意：此 Skill 应集成 RAG，从项目记忆中检索角色相关信息
 */

export const manifest = {
  id: 'character-depth-analyzer',
  name: '角色深度分析器',
  version: '1.0.0',
  description: '分析角色的深度，包括性格、动机、成长弧线等',
  author: 'AIWT Team',
  applicableAgents: ['chapter', 'continue', 'polish'],
  entry: '@/skills/builtin/character-depth-analyzer.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  project: any
  characterId: string
  characterInfo?: string
  context?: string
  llmClient?: any
  ragRetriever?: any
}): Promise<string> {
  console.log('[CharacterDepthAnalyzerSkill] 分析角色:', params.characterId)
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法分析角色。请确保已配置 LLM。`
  }
  
  // 尝试使用 RAG 检索相关信息
  let ragContext = ''
  if (params.ragRetriever) {
    try {
      const query = `角色：${params.characterId}\n${params.characterInfo || ''}`
      const results = await params.ragRetriever.retrieve(query, { topK: 5 })
      
      if (results && results.length > 0) {
        ragContext = '\n\n## 相关记忆\n'
        results.forEach((result: any, index: number) => {
          ragContext += `\n### 记忆 ${index + 1}\n${result.content}\n`
        })
      }
    } catch (error) {
      console.error('[CharacterDepthAnalyzerSkill] RAG 检索失败:', error)
    }
  }
  
  // 获取角色信息
  const character = params.project?.characters?.find((c: any) => c.id === params.characterId)
  const characterInfo = params.characterInfo || (character ? JSON.stringify(character, null, 2) : '未找到角色信息')
  
  // 构建分析提示
  const prompt = `# 角色深度分析任务\n\n请分析以下角色的深度：\n\n## 角色信息\n${characterInfo}${ragContext}\n\n## 要求\n1. 分析角色的性格特点和内心矛盾\n2. 分析角色的动机和目标\n3. 分析角色的人际关系\n4. 分析角色的成长弧线（如果有）\n5. 提出改进建议（使角色更立体）\n6. 格式清晰，分点陈述\n\n请生成分析报告：`
  
  try {
    // 调用 LLM 分析角色
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 3000,
      temperature: 0.7
    })
    
    return `# 角色深度分析报告：${params.characterId}\n\n${result}\n\n---\n分析时间：${new Date().toLocaleString()}`
  } catch (error) {
    console.error('[CharacterDepthAnalyzerSkill] 分析角色失败:', error)
    return `分析角色失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
