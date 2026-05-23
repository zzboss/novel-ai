/**
 * 参考资料查找 Skill
 * 功能：在指定参考资料中检索相关内容
 * 适用于：chapter, continue, polish
 */

export const manifest = {
  id: 'reference-lookup',
  name: '参考资料查找',
  version: '1.0.0',
  description: '在指定参考资料中检索相关内容',
  author: 'AIWT Team',
  applicableAgents: ['chapter', 'continue', 'polish'],
  entry: '@/skills/builtin/reference-lookup.skill.ts',
  requiresToolCall: false
}

export async function execute(params: { 
  query: string
  references?: string[]
  context?: string
  llmClient?: any
}): Promise<string> {
  console.log('[ReferenceLookupSkill] 查找:', params.query)
  
  // 如果没有参考资料，返回提示
  if (!params.references || params.references.length === 0) {
    return `未提供参考资料。请提供参考资料内容，以便进行查找。`
  }
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法进行参考资料查找。请确保已配置 LLM。`
  }
  
  // 构建查找提示
  const prompt = `请在以下参考资料中查找与"${params.query}"相关的内容：\n\n参考资料：\n${params.references.join('\n\n---\n\n')}\n\n查找要求：\n1. 找出与查询最相关的段落\n2. 提供准确的引用\n3. 如果没有找到相关内容，请明确说明\n4. 格式如下：\n\n## 查找结果：${params.query}\n\n### 相关段落 1\n> 引用内容...\n来源：...\n\n### 相关段落 2\n> 引用内容...\n来源：...\n\n（如果未找到，请说明）${params.context ? `\n\n上下文：${params.context}` : ''}`
  
  try {
    // 调用 LLM 进行参考资料查找
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3 // 较低温度，保持准确性
    })
    
    return result
  } catch (error) {
    console.error('[ReferenceLookupSkill] 查找失败:', error)
    return `参考资料查找失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
