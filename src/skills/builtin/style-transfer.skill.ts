/**
 * 文风迁移 Skill
 * 功能：将文本改写为指定作者的文风
 * 适用于：polish
 */

export const manifest = {
  id: 'style-transfer',
  name: '文风迁移',
  version: '1.0.0',
  description: '将文本改写为指定作者的文风',
  author: 'AIWT Team',
  applicableAgents: ['polish'],
  entry: '@/skills/builtin/style-transfer.skill.ts',
  requiresToolCall: false
}

/**
 * 作者文风库
 */
const AUTHOR_STYLES: Record<string, {
  description: string
  characteristics: string[]
  examples: string[]
}> = {
  '鲁迅': {
    description: '冷峻犀利，批判现实',
    characteristics: ['白描手法', '冷峻犀利', '批判现实', '简洁有力', '讽刺幽默'],
    examples: ['其实地上本没有路，走的人多了，也便成了路。', '哀其不幸，怒其不争。']
  },
  '金庸': {
    description: '大气磅礴，侠义江湖',
    characteristics: ['武侠气息', '江湖侠义', '诗词典故', '历史背景', '人物鲜明'],
    examples: ['侠之大者，为国为民。', '人生在世，去若朝露。']
  },
  '古龙': {
    description: '简洁有力，意境深远',
    characteristics: ['短句为主', '意境深远', '哲理思辨', '情感细腻', '出人意表'],
    examples: ['人在江湖，身不由己。', '最孤独的人，往往最坚强。']
  },
  '琼瑶': {
    description: '柔情似水，缠绵悱恻',
    characteristics: ['情感细腻', '缠绵悱恻', '诗词歌赋', '情景交融', '感天动地'],
    examples: ['山无棱，江水为竭，冬雷震震，夏雨雪，天地合，乃敢与君绝。']
  }
}

export async function execute(params: { 
  text: string
  author: string
  context?: string
  llmClient?: any
}): Promise<string> {
  console.log('[StyleTransferSkill] 迁移文风到:', params.author)
  
  // 如果没有 LLM 客户端，返回错误
  if (!params.llmClient) {
    return `错误：无法访问 LLM 客户端，无法进行文风迁移。请确保已配置 LLM。`
  }
  
  // 获取作者文风
  const style = AUTHOR_STYLES[params.author]
  
  // 构建文风迁移提示
  let prompt = `请将以下文本改写为${params.author}的文风：\n\n${params.text}\n\n`
  
  if (style) {
    prompt += `作者文风特点：\n`
    style.characteristics.forEach(char => {
      prompt += `- ${char}\n`
    })
    prompt += `\n参考示例：\n`
    style.examples.forEach(example => {
      prompt += `> ${example}\n`
    })
  } else {
    prompt += `\n注意：未找到"${params.author}"的文风资料，请根据你对这位作者文风的了解进行改写。\n`
  }
  
  prompt += `\n改写要求：\n1. 保持原文意思不变\n2. 模仿${params.author}的文风特点\n3. 语言流畅自然\n4. 保留原文的段落结构${params.context ? `\n5. 参考上下文：${params.context}` : ''}`
  
  try {
    // 调用 LLM 进行文风迁移
    const result = await params.llmClient.generateText({
      prompt: prompt,
      maxTokens: 3000,
      temperature: 0.7 // 适中温度，平衡创造性和准确性
    })
    
    return `# 文风迁移结果（${params.author}风格）\n\n${result}\n\n---\n原文：\n${params.text}\n\n---\n文风特点：${style ? style.characteristics.join('、') : '未知'}`
  } catch (error) {
    console.error('[StyleTransferSkill] 文风迁移失败:', error)
    return `文风迁移失败：${error instanceof Error ? error.message : String(error)}`
  }
}

export default { manifest, execute }
