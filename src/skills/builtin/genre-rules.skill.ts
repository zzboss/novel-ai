/**
 * 类型规则注入 Skill
 * 功能：注入特定类型的写作规则和套路
 * 适用于：outline, chapter, continue
 */

export const manifest = {
  id: 'genre-rules',
  name: '类型规则注入',
  version: '1.0.0',
  description: '注入特定类型的写作规则和套路',
  author: 'AIWT Team',
  applicableAgents: ['outline', 'chapter', 'continue'],
  entry: '@/skills/builtin/genre-rules.skill.ts',
  requiresToolCall: false
}

/**
 * 类型规则库
 */
const GENRE_RULES: Record<string, { 
  description: string
  keyElements: string[]
  plotTemplates: string[]
  writingTips: string[]
}> = {
  '玄幻': {
    description: '以修炼、升级、奇遇为核心的幻想题材',
    keyElements: ['修炼等级体系', '丹药炼制', '宗门势力', '天材地宝', '秘境探险', '法宝武器'],
    plotTemplates: [
      '废柴逆袭：主角初始平庸，获得奇遇后崛起',
      '宗门大比：通过比赛证明实力',
      '秘境探险：探索古迹获得传承',
      '报仇雪恨：击败曾经的敌人'
    ],
    writingTips: [
      '建立清晰的等级体系，让读者有明确目标',
      '合理安排金手指，既不能太弱也不能太强',
      '注重战斗场面的描写，要有画面感',
      '适当加入幽默元素，调节气氛'
    ]
  },
  '都市': {
    description: '以现实生活为背景的现代题材',
    keyElements: ['职场生活', '情感纠葛', '社会热点', '家庭关系', '朋友友谊'],
    plotTemplates: [
      '职场逆袭：从底层员工到行业精英',
      '爱情纠葛：多角关系、误会分离后重逢',
      '创业故事：从小工作室到上市公司',
      '家庭伦理：代际冲突、教育理念差异'
    ],
    writingTips: [
      '注重现实感，避免过于夸张的情节',
      '人物性格要鲜明，有血有肉',
      '对话要自然，符合人物身份',
      '适当融入社会热点，增加代入感'
    ]
  },
  '言情': {
    description: '以情感发展为核心的爱情题材',
    keyElements: ['情感发展', '误会冲突', '甜蜜互动', '虐心情节', '分手复合', '暗恋成真'],
    plotTemplates: [
      '误会分离：因误会而分开，后解开误会复合',
      '契约恋爱：因某种原因假装情侣，后假戏真做',
      '青梅竹马：从小一起长大，最终走到一起',
      '破镜重圆：分手后重新在一起'
    ],
    writingTips: [
      '注重情感描写，细腻入微',
      '合理安排误会和冲突，避免无理取闹',
      '甜蜜场面要自然，不要过于刻意',
      '人物性格要互补，有化学反应'
    ]
  },
  '悬疑': {
    description: '以谜题和解谜为核心的推理题材',
    keyElements: ['谜题设置', '线索埋伏', '反转揭秘', '气氛营造', '心理描写', '逻辑推理'],
    plotTemplates: [
      '密室杀人：看似不可能的犯罪',
      '连环案件：多起相关案件串联',
      '身份谜团：主角或配角身份成谜',
      '时间诡计：利用时间差制造错觉'
    ],
    writingTips: [
      '合理安排线索，既不能太明显也不能太隐蔽',
      '注重气氛营造，让读者有身临其境的感觉',
      '反转要合理，不能为了反转而反转',
      '注重逻辑推理，确保谜题可解'
    ]
  }
}

export async function execute(params: { 
  genre: string
  context: string
  llmClient?: any
}): Promise<string> {
  console.log('[GenreRulesSkill] 注入类型规则:', params.genre)
  
  // 获取类型规则
  const rules = GENRE_RULES[params.genre]
  
  if (!rules) {
    return `未找到类型"${params.genre}"的规则。支持的类型：${Object.keys(GENRE_RULES).join('、')}`
  }
  
  // 构建规则文本
  let result = `# ${params.genre}类型写作规则\n\n`
  result += `## 类型描述\n${rules.description}\n\n`
  
  result += `## 关键元素\n`
  rules.keyElements.forEach(element => {
    result += `- ${element}\n`
  })
  result += `\n`
  
  result += `## 常见情节模板\n`
  rules.plotTemplates.forEach((template, index) => {
    result += `${index + 1}. ${template}\n`
  })
  result += `\n`
  
  result += `## 写作技巧\n`
  rules.writingTips.forEach((tip, index) => {
    result += `${index + 1}. ${tip}\n`
  })
  
  // 如果有 LLM 客户端，可以生成更个性化的建议
  if (params.llmClient && params.context) {
    try {
      const prompt = `基于以下${params.genre}类型规则，针对具体上下文给出写作建议：\n\n规则：\n${result}\n\n上下文：\n${params.context}\n\n请提供具体的写作建议：`
      
      // 注意：这里假设 llmClient 有 generateText 方法
      // 实际实现可能需要根据项目的 LLM 客户端接口调整
      // const personalizedAdvice = await params.llmClient.generateText(prompt)
      // result += `\n\n## 个性化建议\n${personalizedAdvice}`
      
      result += `\n\n（提示：可结合 LLM 生成更个性化的写作建议）`
    } catch (error) {
      console.error('[GenreRulesSkill] LLM 调用失败:', error)
    }
  }
  
  return result
}

export default { manifest, execute }
