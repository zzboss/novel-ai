import { useSettingsStore } from '@/stores/settings'
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
import type { ProjectType } from '@/stores/project'
import { project } from '@/stores/project/state'
import { loadPrompt } from '@/utils/promptLoader'
import {
  filterRelevantWorldSettings,
  filterRelevantCharacters,
  compressPreviousChapters,
  compressChapterOutline,
  getCompressionStrategy
} from '@/utils/contextCompressor'

/**
 * 章节细纲 JSON 数据结构
 */

export interface SceneOutline {
  sceneId: number
  location: string
  emotionalTone: string
  characters: string[]
  events: string
  foreshadowing: string
  twists: string
}

export interface ChapterOutlineJSON {
  chapterTitle: string
  chapterNumber: number
  coreGoal: string
  scenes: SceneOutline[]
  plotProgression: string
  characterDevelopment: string
  nextChapterHook: string
}

/**
 * 生成章节细纲（JSON 格式，非流式）
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的细纲（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param userRequirements - 用户对本章的要求（可选）
 * @param modelConfig - 临时模型配置（可选，不传则使用默认模型）
 * @returns 生成的章节细纲（JSON 字符串）
 */
export async function generateChapterOutline(
  chapterTitle: string,
  chapterNumber: number,
  volumeOutline: string,
  previousChapters: Array<{ title: string; outline: string }>,
  characters: string,
  worldSettings: string,
  projectType: ProjectType,
  userRequirements?: string,
  modelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('chapter-outline')
  setProgressMessage(`正在生成第${chapterNumber}章细纲...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在生成第${chapterNumber}章细纲...`)

  try {
    const settingsStore = useSettingsStore()
    const finalModelConfig = modelConfig || settingsStore.activeModel
    if (!finalModelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const typeMap: Record<ProjectType, string> = {
      'novel': '长篇小说',
      'short-story': '短篇故事',
      'script': '短剧剧本'
    }

    // 构建 system prompt（从模板加载）
    const systemPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_outline_agent',
      'system',
      {} // system prompt 无变量
    )

    // 构建 user prompt（从模板加载）
    // 压缩前文摘要
    const compressedPreviousChapters = compressPreviousChapters(
      previousChapters.map((ch, i) => ({
        title: `第${i + 1}章：${ch.title}`,
        summary: ch.outline
      })),
      3, // 保留最近 3 章
      150 // 每章摘要压缩至 150 字
    )
    
    // 获取压缩策略
    const compressionStrategy = getCompressionStrategy(chapterNumber)
    
    // 压缩世界观设定（如果 not 开篇章节）
    const compressedWorldSettings = compressionStrategy.keepFullWorldSettings
      ? worldSettings
      : filterRelevantWorldSettings(worldSettings, undefined as any) // 细纲生成时暂无细纲，暂时全量传入
    
    const userPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_outline_agent',
      'user',
      {
        projectTitle: project.value?.name || '未命名项目',
        projectType: typeMap[projectType],
        worldSettings: compressedWorldSettings,
        chapterTitle: chapterTitle,
        chapterNumber: String(chapterNumber),
        volumeOutline: volumeOutline,
        previousChapters: compressedPreviousChapters,
        characters: characters, // 细纲生成时暂未过滤角色（因为细纲本身包含角色信息）
        userRequirements: userRequirements && userRequirements.trim() 
          ? `\n\n### 用户对本章的要求\n${userRequirements.trim()}\n` 
          : ''
      }
    )

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateChapterOutline',
      promptTemplateName: 'CHAPTER_OUTLINE_JSON_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        volumeOutline,
        previousChaptersCount: previousChapters?.length || 0,
        projectType,
        userRequirements
      }
    }

    // 使用非流式调用
    const jsonString = await LLMClient.chat(finalModelConfig, messages, 'chapter-outline', loggingConfig)

    // 尝试解析 JSON，确保格式正确
    try {
      // 有些模型会在 JSON 前后添加多余内容，尝试提取 JSON 部分
      // 使用非贪婪匹配，并从第一个 { 找到最后一个匹配的 }
      let extractedJson = jsonString.trim()
      
      // 方法1：尝试直接解析
      try {
        JSON.parse(extractedJson)
        setProgressMessage(`第${chapterNumber}章细纲生成完成`)
        return extractedJson
      } catch {
        // 方法2：提取 ```json ``` 代码块中的内容
        const codeBlockMatch = jsonString.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
        if (codeBlockMatch) {
          extractedJson = codeBlockMatch[1].trim()
          JSON.parse(extractedJson)
          setProgressMessage(`第${chapterNumber}章细纲生成完成`)
          return extractedJson
        }
        
        // 方法3：找到第一个 { 和最后一个 } 之间的内容
        const firstBrace = jsonString.indexOf('{')
        const lastBrace = jsonString.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          extractedJson = jsonString.slice(firstBrace, lastBrace + 1)
          JSON.parse(extractedJson)
          setProgressMessage(`第${chapterNumber}章细纲生成完成`)
          return extractedJson
        }
        
        throw new Error('无法提取有效 JSON')
      }
    } catch (parseErr) {
      console.error('JSON 解析失败：', parseErr)
      console.error('原始输出：', jsonString)
      throw new Error('AI 返回的 JSON 格式不正确，请重试')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `生成第${chapterNumber}章细纲失败`
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 根据章节细纲生成章节正文
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param chapterOutline - 章节细纲
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的摘要（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param targetWords - 目标字数（可选）
 * @returns 生成的章节正文
 */
/**
 * 根据章节细纲生成章节正文
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param chapterOutline - 章节细纲
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的摘要（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param targetWords - 目标字数（可选）
 * @param modelConfig - 临时模型配置（可选，不传则使用默认模型）
 * @returns 生成的章节正文
 */
export async function generateChapterContent(
  chapterTitle: string,
  chapterNumber: number,
  chapterOutline: string,
  _volumeOutline: string, // 前缀 _ 表示未使用参数
  previousChapters: Array<{ title: string; summary: string }>,
  characters: string,
  worldSettings: string,
  projectType: ProjectType,
  targetWords?: number,
  modelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('chapter-content')
  setProgressMessage(`正在生成第${chapterNumber}章正文...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在生成第${chapterNumber}章正文...`)

  try {
    // 如果传入了 modelConfig，使用传入的；否则使用默认模型
    const settingsStore = useSettingsStore()
    const finalModelConfig = modelConfig || settingsStore.activeModel
    if (!finalModelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const typeMap: Record<ProjectType, string> = {
      'novel': '长篇小说',
      'short-story': '短篇故事',
      'script': '短剧剧本'
    }

    // 构建 user prompt（从模板加载）
    // 压缩前文摘要
    const compressedPreviousChapters = compressPreviousChapters(
      previousChapters.map((ch, i) => ({
        title: `第${i + 1}章：${ch.title}`,
        summary: ch.summary
      })),
      3, // 保留最近 3 章
      150 // 每章摘要压缩至 150 字
    )
    
    // 过滤相关角色（根据章节细纲）
    const compressedCharacters = filterRelevantCharacters(characters, chapterOutline)
    
    // 过滤相关世界观设定（根据章节细纲）
    const compressedWorldSettings = filterRelevantWorldSettings(worldSettings, chapterOutline)
    
    // 压缩章节细纲
    const compressedOutline = compressChapterOutline(chapterOutline)
    
    // 获取上一章末尾 500 字（用于衔接）
    let lastChapterTail = ''
    if (previousChapters && previousChapters.length > 0) {
      const lastChapter = previousChapters[previousChapters.length - 1]
      // 假设 summary 包含正文内容，或者需要从其他地方获取
      // TODO: 实际实现时需要从章节内容中获取末尾 500 字
      lastChapterTail = lastChapter.summary.slice(-500)
    }
    
    // 从章节细纲中提取情绪基调
    let emotionTone = ''
    try {
      const outline = JSON.parse(chapterOutline)
      if (outline.scenes && outline.scenes.length > 0) {
        emotionTone = outline.scenes.map((s: any) => s.emotionalTone).join(' → ')
      }
    } catch {
      emotionTone = ''
    }
    
    // 从章节细纲中提取视角人物（第一个场景的第一个角色）
    let povCharacter = ''
    try {
      const outline = JSON.parse(chapterOutline)
      if (outline.scenes && outline.scenes.length > 0 && outline.scenes[0].characters.length > 0) {
        povCharacter = outline.scenes[0].characters[0]
      }
    } catch {
      povCharacter = ''
    }

    const userPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_agent',
      'user',
      {
        projectTitle: project.value?.name || '未命名项目',
        genre: typeMap[projectType],
        tone: project.value?.tone || '自动匹配',
        synopsis: project.value?.synopsis || '',
        chapterPosition: `全书第${chapterNumber}章`,
        previousChapterSummaries: compressedPreviousChapters,
        lastChapterTail: lastChapterTail,
        relevantCharacters: compressedCharacters || characters, // 如果过滤失败，使用原始角色
        relevantWorldSettings: compressedWorldSettings || worldSettings, // 如果过滤失败，使用原始设定
        chapterTitle: chapterTitle,
        chapterOutline: compressedOutline,
        povCharacter: povCharacter,
        targetWordCount: targetWords ? String(targetWords) : '3000',
        emotionTone: emotionTone,
        specialNotes: ''
      }
    )

    const messages: LLMMessage[] = [
      { role: 'user', content: userPrompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateChapterContent',
      promptTemplateName: 'CHAPTER_CONTENT_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        chapterOutline: chapterOutline.substring(0, 200) + '...',
        previousChaptersCount: previousChapters?.length || 0,
        projectType,
        targetWords
      }
    }

    await LLMClient.streamWithCallbacks(finalModelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage(`第${chapterNumber}章正文生成完成`)
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'chapter-content', loggingConfig)

    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `生成第${chapterNumber}章正文失败`
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 根据用户输入生成章节细纲（支持临时模型）
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的细纲（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param userInput - 用户输入的要求（可选）
 * @param modelConfig - 临时模型配置（可选）
 * @returns 生成的章节细纲
 */
export async function generateChapterOutlineWithInput(
  chapterTitle: string,
  chapterNumber: number,
  volumeOutline: string,
  previousChapters: Array<{ title: string; outline: string }>,
  characters: string,
  worldSettings: string,
  projectType: ProjectType,
  userInput?: string,
  modelConfig?: ModelConfig
): Promise<string> {
  // 直接复用 generateChapterOutline，传入 userRequirements
  return generateChapterOutline(
    chapterTitle,
    chapterNumber,
    volumeOutline,
    previousChapters,
    characters,
    worldSettings,
    projectType,
    userInput,
    modelConfig
  )
}

/**
 * 修改/优化章节细纲（JSON 格式，非流式）
 * @param currentOutline - 当前细纲（JSON 字符串）
 * @param modificationRequest - 修改要求
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param context - 上下文信息（卷大纲、角色等）
 * @returns 修改后的章节细纲（JSON 字符串）
 */
export async function modifyChapterOutline(
  currentOutline: string,
  modificationRequest: string,
  chapterTitle: string,
  chapterNumber: number,
  context: {
    volumeOutline: string
    characters: string
    worldSettings: string
  },
  modelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('chapter-outline-modify')
  setProgressMessage(`正在修改第${chapterNumber}章细纲...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在修改第${chapterNumber}章细纲...`)

  try {
    const settingsStore = useSettingsStore()
    const finalModelConfig = modelConfig || settingsStore.activeModel
    if (!finalModelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 构建 system prompt（从模板加载）
    const systemPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_outline_modify_agent',
      'system',
      {} // system prompt 无变量
    )

    // 构建 user prompt（从模板加载）
    const userPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_outline_modify_agent',
      'user',
      {
        currentOutline: currentOutline,
        modificationRequest: modificationRequest,
        volumeOutline: context.volumeOutline,
        characters: context.characters,
        worldSettings: context.worldSettings
      }
    )

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyChapterOutline',
      promptTemplateName: 'CHAPTER_OUTLINE_MODIFY_JSON_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        modificationRequest,
        currentOutlineLength: currentOutline.length
      }
    }

    // 使用非流式调用
    const jsonString = await LLMClient.chat(finalModelConfig, messages, 'chapter-outline-modify', loggingConfig)

    // 尝试解析 JSON，确保格式正确
    try {
      // 有些模型会在 JSON 前后添加多余内容，尝试提取 JSON 部分
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      const extractedJson = jsonMatch ? jsonMatch[0] : jsonString
      JSON.parse(extractedJson) // 验证 JSON 格式
      setProgressMessage(`第${chapterNumber}章细纲修改完成`)
      return extractedJson
    } catch (parseErr) {
      console.error('JSON 解析失败：', parseErr)
      console.error('原始输出：', jsonString)
      throw new Error('AI 返回的 JSON 格式不正确，请重试')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `修改第${chapterNumber}章细纲失败`
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 根据章节细纲和用户输入生成章节正文（支持临时模型）
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param chapterOutline - 章节细纲
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的摘要（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param userInput - 用户输入的要求（可选）
 * @param modelConfig - 临时模型配置（可选）
 * @returns 生成的章节正文
 */
export async function generateChapterContentWithInput(
  chapterTitle: string,
  chapterNumber: number,
  chapterOutline: string,
  volumeOutline: string,
  previousChapters: Array<{ title: string; summary: string }>,
  characters: string,
  worldSettings: string,
  projectType: ProjectType,
  userInput?: string,
  modelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('chapter-content')
  setProgressMessage(`正在生成第${chapterNumber}章正文...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在生成第${chapterNumber}章正文...`)

  try {
    // 如果传入了 modelConfig，使用传入的；否则使用默认模型
    const settingsStore = useSettingsStore()
    const finalModelConfig = modelConfig || settingsStore.activeModel
    if (!finalModelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 构建 user prompt（从模板加载）
    const previousChaptersText = previousChapters && previousChapters.length > 0
      ? previousChapters.map((ch, i) => `--- 第${i + 1}章：${ch.title} ---\n${ch.summary}`).join('\n\n')
      : ''

    const userPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_content_with_input_agent',
      'user',
      {
        chapterTitle: chapterTitle,
        chapterNumber: String(chapterNumber),
        chapterOutline: chapterOutline,
        volumeOutline: volumeOutline,
        worldSettings: worldSettings,
        characters: characters,
        previousChapters: previousChaptersText,
        userInput: userInput && userInput.trim() ? userInput.trim() : ''
      }
    )

    // 构建 system prompt（从模板加载）
    const systemPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_content_with_input_agent',
      'system',
      {} // system prompt 无变量
    )

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateChapterContent',
      promptTemplateName: 'CHAPTER_CONTENT_WITH_INPUT_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        chapterOutline: chapterOutline.substring(0, 200) + '...',
        previousChaptersCount: previousChapters?.length || 0,
        projectType,
        userInput: userInput || ''
      }
    }

    await LLMClient.streamWithCallbacks(finalModelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage(`第${chapterNumber}章正文生成完成`)
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'chapter-content', loggingConfig)

    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `生成第${chapterNumber}章正文失败`
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 修改/优化章节正文
 * @param currentContent - 当前正文 HTML
 * @param selectedText - 选中的文本（可选，如果有则只修改选中部分）
 * @param modificationRequest - 修改要求
 * @param modelConfig - 临时模型配置（可选）
 * @returns 修改后的章节正文
 */
export async function modifyChapterContent(
  currentContent: string,
  selectedText: string,
  modificationRequest: string,
  modelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('chapter-content-modify')
  setProgressMessage('正在修改章节正文...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在修改章节正文...')

  try {
    const settingsStore = useSettingsStore()
    const finalModelConfig = modelConfig || settingsStore.activeModel
    if (!finalModelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 构建 system prompt（从模板加载）
    const systemPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_content_modify_agent',
      'system',
      {} // system prompt 无变量
    )

    // 构建 user prompt（从模板加载）
    const userPrompt = await loadPrompt(
      'a_精密构造',
      'chapter_content_modify_agent',
      'user',
      {
        currentContent: currentContent,
        selectedText: selectedText && selectedText.trim() ? `\n=== 选中要修改的文本 ===\n${selectedText}\n` : '',
        modificationRequest: modificationRequest || '请优化这段正文，使其更流畅、更有感染力'
      }
    )

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyChapterContent',
      promptTemplateName: 'CHAPTER_CONTENT_MODIFY_PROMPT',
      inputParameters: {
        hasSelectedText: !!selectedText,
        modificationRequest,
        currentContentLength: currentContent.length
      }
    }

    await LLMClient.streamWithCallbacks(finalModelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('章节正文修改完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'chapter-content-modify', loggingConfig)

    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '修改章节正文失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
