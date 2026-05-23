/**
 * 翻译 Skill
 * 功能：将文本翻译为指定语言
 * 适用于：polish
 */

export const manifest = {
  id: 'translation',
  name: '翻译',
  version: '1.0.0',
  description: '将文本翻译为指定语言',
  author: 'AIWT Team',
  applicableAgents: ['polish'],
  entry: '@/skills/builtin/translation.skill.ts',
  requiresToolCall: false
}

export async function execute(params: { 
  text: string
  targetLang: string
  context?: string
  llmClient?: any
}): Promise<string> {
  console.log('[TranslationSkill] 翻译到:', params.targetLang)
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法进行翻译。请确保已配置 LLM。`
  }
  
  // 构建翻译提示
  const prompt = `请将以下文本翻译为${params.targetLang}：\n\n${params.text}\n\n翻译要求：\n1. 保持原文的语气和风格\n2. 确保翻译准确、自然\n3. 如果是文学文本，注意保留文学性${params.context ? `\n4. 参考上下文：${params.context}` : ''}`
  
  try {
    // 调用 LLM 进行翻译
    // 注意：这里假设 llmClient 有 generateText 方法
    // 实际实现可能需要根据项目的 LLM 客户端接口调整
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3 // 翻译任务需要较低的温度以保持准确性
    })
    
    return `# 翻译结果（${params.targetLang}）\n\n${result}\n\n---\n原文：\n${params.text}`
  } catch (error) {
    console.error('[TranslationSkill] 翻译失败:', error)
    return `翻译失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
