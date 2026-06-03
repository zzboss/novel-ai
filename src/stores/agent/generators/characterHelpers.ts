import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage, ModelConfig } from '@/llm/types'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 根据用户描述生成角色（简化版，用于AI辅助生成）
 * @param projectType - 项目类型
 * @param userDescription - 用户描述或关键词
 * @param loggingConfig - 可选的日志记录配置
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 生成的角色内容
 */
export async function generateCharacterByDescription(
  projectType: ProjectType = 'novel',
  userDescription?: string,
  loggingConfig?: LLMLoggingConfig,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('character')
  setProgressMessage('正在生成角色...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成角色...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 优先使用用户选择的模型配置，否则使用角色生成专用的模型配置（如果未配置则回退到默认模型）
    const modelConfig = selectedModelConfig || settingsStore.getAgentModel('character') || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 获取项目上下文（从 projectStore 获取）
    let projectIdea = ''
    let projectWorldSettings: { summary?: string } = {}
    let projectCharacters: any[] = []
    
    try {
      const projectStore = useProjectStore()
      const project = projectStore.project
      if (project) {
        projectIdea = project.idea || ''
        // 从 project.worldSettings 生成摘要（因为类型不同）
        if (project.worldSettings) {
          const ws = project.worldSettings
          projectWorldSettings = {
            summary: `类型：${ws.genre}，基调：${ws.tone}，规则：${ws.rules}，地点：${ws.locations.join('、')}`
          }
        }
        projectCharacters = project.characters || []
      }
    } catch (e) {
      // projectStore 可能未初始化
    }
    
    // 直接使用用户输入作为提示词（跳过优化步骤，避免优化产生垃圾内容）
    setProgressMessage('正在生成角色内容...')
    
    // 构建完整的用户提示词（包含项目上下文）
    const fullUserPrompt = `请为我的${projectType || '小说'}生成一个角色。

## 用户描述
${userDescription || '请生成一个有趣的角色'}

## 项目背景
- 故事类型: ${projectType || '未指定'}
- 故事简介: ${projectIdea || '未指定'}
- 世界观: ${projectWorldSettings?.summary || '未指定'}

## 已有角色
${projectCharacters?.length > 0 ? projectCharacters.map((c: any) => `- ${c.name} (${c.role})`).join('\n') : '无（这是第一个角色）'}

请根据上述信息，生成一个符合项目背景和已有角色的独特角色。`
    
    // 构建完整的提示词（要求返回 JSON 格式）
    const fullPrompt = `你是一位专业的小说角色设计师。请根据用户的描述，生成一个完整、有深度的角色设定。

输出要求：
1. 必须返回一个有效的 JSON 对象，不要包含任何其他文字或格式标记
2. 所有文本内容使用中文
3. 每个属性的内容要具体、有记忆点，包含生动的细节，不少于三句话
4. 确保返回的是纯 JSON，可以被 JSON.parse() 正确解析

输出 JSON 格式（必须严格按照此格式）：
{
  "name": "角色姓名",
  "gender": "male",
  "age": 42,
  "role": "supporting",
  "appearance": "外貌描述（不少于三句话，具体生动）",
  "personality": "性格特点描述（不少于三句话，具体生动）",
  "background": "背景故事（不少于三句话，具体生动）",
  "abilities": "能力/技能描述（不少于三句话，具体生动）",
  "motivation": "核心动机描述（不少于三句话，具体生动）",
  "arc": "成长弧线描述（不少于三句话，具体生动）",
  "dialogueStyle": "对话风格描述（不少于三句话，具体生动）",
  "relationships": "和主角的关系描述（不少于三句话，具体生动）"
}

字段说明：
- name: 字符串，角色姓名
- gender: 字符串，只能是 "male"（男）、"female"（女）或 "other"（其他）
- age: 数字或 null，角色年龄
- role: 字符串，只能是 "protagonist"（主角）、"antagonist"（反派）、"supporting"（配角）或 "minor"（龙套）
- appearance: 字符串，外貌描述
- personality: 字符串，性格特点描述
- background: 字符串，背景故事
- abilities: 字符串，能力/技能描述
- motivation: 字符串，核心动机
- arc: 字符串，成长弧线
- dialogueStyle: 字符串，对话风格
- relationships: 字符串，和主角的关系

重要：
- 只返回纯 JSON 对象，不要添加 markdown 代码块标记（如 \`\`\`json），不要添加任何解释文字
- 确保 JSON 格式正确，所有字符串用双引号，布尔值和数字不用引号
- 如果某个字段不确定，可以留空字符串或 null，但不要省略字段

用户需求：
${fullUserPrompt}

请直接返回 JSON 对象：`

    // 构建消息数组（只使用一条 user 消息，提高兼容性）
    const messages: LLMMessage[] = [
      { role: 'user', content: fullPrompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置（优先使用传入的配置）
    if (!loggingConfig) {
      loggingConfig = {
        operationType: 'generateCharacter',
        promptTemplateName: 'character-generate',
        inputParameters: { userDescription, projectType }
      }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('角色生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'character-generate', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成角色失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 为角色的单个属性生成AI建议（多条建议供多选）
 * @param character - 已有基本信息的角色对象
 * @param _fieldKey - 需要生成建议的属性名
 * @param fieldLabel - 属性的中文名
 * @returns 多条建议字符串
 */
export async function generateFieldSuggestions(
  character: { name: string; appearance?: string; personality?: string; background?: string; description?: string; role?: string },
  _fieldKey: string,
  fieldLabel: string,
  currentValue?: string
): Promise<string[]> {
  setAiProcessing(true, `正在生成${fieldLabel}建议...`)

  try {
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.getAgentModel('character') || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const currentFieldLine = currentValue
      ? `- ${fieldLabel}（当前值）：${currentValue}`
      : ''

    const prompt = `你是一位专业的小说角色设计师。请为以下角色生成"${fieldLabel}"的建议。

角色信息：
- 姓名：${character.name}
- 角色定位：${character.role || '未指定'}
- 外貌：${character.appearance || '未指定'}
- 性格：${character.personality || '未指定'}
- 背景：${character.background || '未指定'}
- 描述：${character.description || '未指定'}
${currentFieldLine}
请为"${fieldLabel}"生成3条不同的建议，要求：
1. 每条建议2-4句话
2. 3条建议风格各异（如一条简练、一条详细、一条反转等）
3. ${currentValue ? '基于当前已有内容进行优化、扩展或改写，使其更加充实、生动' : '内容要与角色其他信息协调一致'}

输出格式：每条建议单独一段，用数字编号，格式如下：
1. 第一条建议内容
2. 第二条建议内容
3. 第三条建议内容`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    let fullContent = ''
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
      },
      onDone: () => {},
      onError: (error: Error) => {
        throw error
      }
    }, 'field-suggestions')

    // 按序号或空行分割成多条建议
    // 优先按序号（1. 2. 3. 或 一、二、三、）分割，否则按空行分割
    let suggestions: string[] = []
    const numberedMatch = fullContent.match(/(?:^|\n)\s*(?:\d+[.、)）]\s*|[一二三四五六七八九十]+[、.）)]\s*)([\s\S]*?)(?=(?:\n\s*(?:\d+[.、)）]\s*|[一二三四五六七八九十]+[、.）)]\s*))|$)/g)
    if (numberedMatch && numberedMatch.length >= 2) {
      suggestions = numberedMatch.map(s => s.trim().replace(/^\s*(?:\d+[.、)）]\s*|[一二三四五六七八九十]+[、.）)]\s*)/, '').trim()).filter(s => s.length > 0)
    } else {
      // 按空行分割
      suggestions = fullContent
        .split(/\n\s*\n/)
        .map(s => s.trim().replace(/^\d+[.、)）]\s*/, '').trim())
        .filter(s => s.length > 0)
    }

    return suggestions.length > 0 ? suggestions : [fullContent.trim()]
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成建议失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
  }
}
