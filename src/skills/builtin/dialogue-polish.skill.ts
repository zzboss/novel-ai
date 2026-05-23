/**
 * 对话润色器 Skill
 * 功能：润色对话，使其更自然、更符合角色性格
 * 适用于：polish
 * 
 * 注意：此 Skill 应集成 RAG，从项目记忆中检索角色相关信息
 */

export const manifest = {
  id: 'dialogue-polish',
  name: '对话润色器',
  version: '1.0.0',
  description: '润色对话，使其更自然、更符合角色性格',
  author: 'AIWT Team',
  applicableAgents: ['polish'],
  entry: '@/skills/builtin/dialogue-polish.skill.ts',
  requiresToolCall: false
}

export async function execute(params: {
  project: any
  dialogue: string
  characterIds?: string[]
  context?: string
  llmClient?: any
  ragRetriever?: any
}): Promise<string> {
  console.log('[DialoguePolishSkill] 润色对话')
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法润色对话。请确保已配置 LLM。`
  }
  
  // 尝试使用 RAG 检索相关信息
  let ragContext = ''
  if (params.ragRetriever && params.characterIds) {
    try {
      const query = `角色：${params.characterIds.join(', ')}\n对话：${params.dialogue.substring(0, 200)}`
      const results = await params.ragRetriever.retrieve(query, { topK: 5 })
      
      if (results && results.length > 0) {
        ragContext = '\n\n## 相关记忆\n'
        results.forEach((result: any, index: number) => {
          ragContext += `\n### 记忆 ${index + 1}\n${result.content}\n`
        })
      }
    } catch (error) {
      console.error('[DialoguePolishSkill] RAG 检索失败:', error)
    }
  }
  
  // 获取角色信息
  let characterInfo = ''
  if (params.characterIds && params.project?.characters) {
    const characters = params.project.characters.filter((c: any) => 
      params.characterIds!.includes(c.id)
    )
    
    if (characters.length > 0) {
      characterInfo = '\n\n## 角色信息\n'
      characters.forEach((character: any) => {
        characterInfo += `\n### ${character.name}\n`
        characterInfo += `性格：${character.personality || '未知'}\n`
        characterInfo += `背景：${character.background || '未知'}\n`
      })
    }
  }
  
  // 构建润色提示
  const prompt = `# 对话润色任务\n\n请润色以下对话，使其更自然、更符合角色性格：\n\n## 原始对话\n${params.dialogue}\n\n## 要求\n1. 保持对话原意不变\n2. 使对话更符合角色性格（见角色信息）\n3. 使对话更自然、流畅\n4. 注意对话的节奏和张力\n5. 保留对话标签（如"他说："）\n6. 格式清晰，易于阅读\n\n请提供润色后的对话：${characterInfo}${ragContext}`
  
  try {
    // 调用 LLM 润色对话
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 3000,
      temperature: 0.7
    })
    
    return `# 润色后的对话\n\n${result}\n\n---\n原始对话：\n${params.dialogue}\n\n---\n润色时间：${new Date().toLocaleString()}`
  } catch (error) {
    console.error('[DialoguePolishSkill] 润色对话失败:', error)
    return `润色对话失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
