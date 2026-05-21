import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage } from '@/llm/types'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 根据用户描述生成卷内容（AI辅助生成）
 * @param projectType - 项目类型
 * @param userDescription - 用户描述或关键词
 * @param volumeIndex - 卷序号（从1开始）
 * @param existingContent - 现有卷内容（用于修改模式）
 * @param loggingConfig - 可选的日志记录配置
 * @param selectedModelConfig - 可选，指定使用的模型配置（如不指定则使用默认模型）
 * @returns 生成的卷内容
 */
export async function generateVolumeByDescription(
  projectType: ProjectType = 'novel',
  userDescription?: string,
  volumeIndex: number = 1,
  existingContent?: string,
  loggingConfig?: LLMLoggingConfig,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('volume')
  setProgressMessage('正在生成卷内容...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成卷内容...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 使用指定的模型配置，如未指定则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.getAgentModel('outline') || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 获取项目上下文（从 projectStore 获取）
    let projectIdea = ''
    let projectWorldSettings: { summary?: string } = {}
    let projectCharacters: any[] = []
    let existingVolumes: string[] = []
    
    try {
      const projectStore = useProjectStore()
      const project = projectStore.project
      if (project) {
        projectIdea = project.idea || ''
        // 从 project.worldSettings 生成摘要
        if (project.worldSettings) {
          const ws = project.worldSettings
          projectWorldSettings = {
            summary: `类型：${ws.genre}，基调：${ws.tone}，规则：${ws.rules}，地点：${ws.locations.join('、')}`
          }
        }
        projectCharacters = project.characters || []
        
        // 获取已存在的卷（用于保持连贯性）
        if (project.volumes && project.volumes.length > 0) {
          existingVolumes = project.volumes.map((v: any) => `第${v.volumeNumber || v.id}卷：${v.title}\n${v.summary || ''}`)
        }
      }
    } catch (e) {
      // projectStore 可能未初始化
    }
    
    // 构建完整的用户提示词
    const hasUserDescription = userDescription && userDescription.trim()
    const fullUserPrompt = hasUserDescription 
      ? `请为我的${projectType || '小说'}生成第${volumeIndex}卷的内容。

## 用户描述
${userDescription}

## 项目背景
- 故事类型: ${projectType || '未指定'}
- 故事简介: ${projectIdea || '未指定'}
- 世界观: ${projectWorldSettings?.summary || '未指定'}

## 已有角色
${projectCharacters?.length > 0 ? projectCharacters.map((c: any) => `- ${c.name} (${c.role})`).join('\n') : '无'}

## 已生成的卷
${existingVolumes?.length > 0 ? existingVolumes.join('\n\n') : '无（这是第一卷）'}

请根据上述信息，生成符合项目背景和故事发展的第${volumeIndex}卷内容。`
      : `请为我的${projectType || '小说'}生成第${volumeIndex}卷的内容。

## 项目背景
- 故事类型: ${projectType || '未指定'}
- 故事简介: ${projectIdea || '未指定'}
- 世界观: ${projectWorldSettings?.summary || '未指定'}

## 已有角色
${projectCharacters?.length > 0 ? projectCharacters.map((c: any) => `- ${c.name} (${c.role})`).join('\n') : '无'}

## 已生成的卷
${existingVolumes?.length > 0 ? existingVolumes.join('\n\n') : '无（这是第一卷）'}

重要：没有具体的用户描述，请根据 above 项目背景信息，发挥创意生成第${volumeIndex}卷的内容。确保内容与其他卷保持连贯性。`

    // 构建完整的提示词
    const unitMap: Record<string, string> = {
      'novel': '卷',
      'short-story': '部分',
      'script': '集'
    }
    const unit = unitMap[projectType] || '卷'
    
    let fullPrompt = ''
    
    if (existingContent) {
      // 修改模式：基于现有内容进行修改
      fullPrompt = `你是一位专业的${projectType === 'novel' ? '小说' : projectType === 'script' ? '剧本' : '故事'}结构设计师。请根据用户的修改意见，修改第${volumeIndex}${unit}的内容。

## 现有卷内容
${existingContent}

## 用户修改意见
${userDescription || '请优化现有内容'}

修改要求：
1. 保留原有内容的合理部分
2. 根据用户意见进行修改
3. 确保修改后的内容连贯、合理
4. 使用中文
5. 必须按照原有格式输出（包含卷标题、核心事件、角色发展、情感基调等字段）
6. 必须以"---"结束输出

重要：请直接输出修改后的完整内容，不要添加任何解释。`
    } else {
      // 生成模式：生成新内容
      const hasUserDesc = userDescription && userDescription.trim()
      fullPrompt = `你是一位专业的${projectType === 'novel' ? '小说' : projectType === 'script' ? '剧本' : '故事'}结构设计师。请根据${hasUserDesc ? '用户的描述和项目背景' : '项目背景信息'}，生成第${volumeIndex}${unit}的完整内容。

${hasUserDesc ? `## 用户描述\n${userDescription}\n` : ''}## 项目背景
- 故事类型: ${projectType || '未指定'}
- 故事简介: ${projectIdea || '未指定'}
- 世界观: ${projectWorldSettings?.summary || '未指定'}

## 已有角色
${projectCharacters?.length > 0 ? projectCharacters.map((c: any) => `- ${c.name} (${c.role})`).join('\n') : '无'}

## 已生成的卷
${existingVolumes?.length > 0 ? existingVolumes.join('\n\n') : '无（这是第一卷）'}

输出要求：
1. 严格按照下面的"输出示例"格式生成，不要添加任何其他内容
2. 每个属性的内容要充实完整，确保卷的结构清晰
3. 使用中文生成
4. 内容要具体、有记忆点，包含生动的情节设计
5. 必须以"---"结束输出
6. 各属性之间用空行分隔
7. 确保与已有卷的内容保持连贯性

输出示例（请严格按照此格式）：
${unit}标题：破晓之战

核心事件：
主角团历经磨难终于抵达魔王城，却发现魔王早已死去多时。真正的敌人是潜伏在身边的黑暗教团。经过一番苦战，主角觉醒了隐藏的力量，终于击败了教团首领，迎来了黎明。本卷以大规模的战斗场面为主，同时穿插角色之间的情感纠葛。

角色发展：
- 李青云：从复仇者转变为守护者，学会了信任他人，与主角建立了深厚的师徒情谊
- 女主角：逐渐放下心防，开始接受主角的存在，两人关系有明显进展
- 反派角色：揭露了黑暗教团的真面目，原来是当年的灭门惨案的主谋

情感基调：
热血沸腾中带着一丝悲壮，战斗场面激烈，但也不乏温馨的日常描写。结尾处曙光照耀大地，给人以希望和感动。

---

重要：请严格按照上面的示例格式生成，包含所有字段，必须以"---"结束。请根据项目背景信息发挥创意，生成高质量的内容。`
    }  // 关闭 else 块

    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: fullPrompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置（优先使用传入的配置）
    if (!loggingConfig) {
      const opType = existingContent ? 'modifyVolume' : 'generateVolume'
      loggingConfig = {
        operationType: opType,
        promptTemplateName: 'volume-generate',
        inputParameters: { userDescription, projectType, volumeIndex, isModify: !!existingContent }
      }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('卷内容生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'volume-generate', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成卷内容失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
