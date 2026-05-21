import { useSettingsStore } from '@/stores/settings'
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
import type { ProjectType } from '@/stores/project'
import type { Chapter } from '@/types/project'

/**
 * 生成章节细纲
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param volumeOutline - 所属卷的大纲
 * @param previousChapters - 前面章节的细纲（用于连贯性）
 * @param characters - 角色设定
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param userRequirements - 用户对本章的要求（可选）
 * @param modelConfig - 临时模型配置（可选，不传则使用默认模型）
 * @returns 生成的章节细纲
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

    let prompt = `你是一位资深${typeMap[projectType]}作家。请根据以下信息，设计第${chapterNumber}章的详细细纲。

=== 本章信息 ===
章节标题：${chapterTitle}
章节序号：第${chapterNumber}章

=== 所属卷大纲 ===
${volumeOutline}

=== 世界观设定 ===
${worldSettings}

=== 角色设定 ===
${characters}
`

    // 添加前面章节的细纲，保证连贯性
    if (previousChapters && previousChapters.length > 0) {
      prompt += `
=== 前面章节的细纲 ===
${previousChapters.map((ch, i) => `--- 第${i + 1}章：${ch.title} ---\n${ch.outline}`).join('\n\n')}

注意：必须与前文保持连贯，承接前文情节发展。
`
    }

    // 用户要求
    if (userRequirements && userRequirements.trim()) {
      prompt += `
=== 用户对本章的要求 ===
${userRequirements.trim()}

请根据用户的要求来设计本章的细纲，同时优化和补充用户提出的想法。
`
    }

    prompt += `
=== 输出要求 ===
请设计第${chapterNumber}章的详细细纲，包含：

1. **本章核心目标**：这一章要达成的主要叙事目标
2. **场景列表**：本章包含的场景，每个场景包括：
   - 场景位置
   - 在场角色
   - 主要事件
   - 情感基调
3. **情节推进**：本章如何推动整体剧情
4. **角色发展**：主要角色在本章中的成长和变化
5. **关键对话**：预设的关键对话要点（不必写出完整对话）
6. **伏笔/转折**：本章埋下的伏笔或发生的转折

重要：
- 细纲要具体且可操作，能直接指导正文写作
- 确保与前后章节连贯
- 场景描述要清晰，包含足够的细节
- 使用清晰的标题和编号
- 输出格式使用 Markdown
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateChapterOutline',
      promptTemplateName: 'CHAPTER_OUTLINE_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        volumeOutline,
        previousChaptersCount: previousChapters?.length || 0,
        projectType,
        userRequirements
      }
    }

    await LLMClient.streamWithCallbacks(finalModelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage(`第${chapterNumber}章细纲生成完成`)
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'chapter-outline', loggingConfig)

    return fullContent
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
  volumeOutline: string,
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

    let prompt = `你是一位资深${typeMap[projectType]}作家。请根据以下信息，创作第${chapterNumber}章的正文。

=== 本章信息 ===
章节标题：${chapterTitle}
章节序号：第${chapterNumber}章

=== 章节细纲 ===
${chapterOutline}

=== 所属卷大纲 ===
${volumeOutline}

=== 世界观设定 ===
${worldSettings}

=== 角色设定 ===
${characters}
`

    // 添加前面章节的摘要，保证连贯性
    if (previousChapters && previousChapters.length > 0) {
      prompt += `
=== 前面章节摘要 ===
${previousChapters.map((ch, i) => `--- 第${i + 1}章：${ch.title} ---\n${ch.summary}`).join('\n\n')}

注意：必须与前文保持连贯，承接前文情节发展。
`
    }

    prompt += `
=== 输出要求 ===
请根据章节细纲创作第${chapterNumber}章的正文：

1. **文体要求**：
   - 使用流畅的叙述性语言
   - 对话要自然、符合角色性格
   - 描写要生动、有画面感
   ${targetWords ? `- 目标字数：约${targetWords}字` : ''}

2. **内容要求**：
   - 严格按照细纲的结构和重点来创作
   - 确保每个场景都得到充分展开
   - 角色行为要符合其性格和动机
   - 情节推进要自然、有张力

3. **格式要求**：
   - 使用 Markdown 格式
   - 场景之间用分隔线（---）隔开
   - 对话使用引号
   - 段落清晰，易于阅读

重要：
- 直接输出正文内容，不要包含解释或说明
- 确保与前后章节连贯
- 文风要一致
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
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
 * 修改/优化章节细纲
 * @param currentOutline - 当前细纲
 * @param modificationRequest - 修改要求
 * @param chapterTitle - 章节标题
 * @param chapterNumber - 章节序号
 * @param context - 上下文信息（卷大纲、角色等）
 * @returns 修改后的章节细纲
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
  }
): Promise<string> {
  setCurrentStep('chapter-outline-modify')
  setProgressMessage(`正在修改第${chapterNumber}章细纲...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在修改第${chapterNumber}章细纲...`)

  try {
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const prompt = `你是一位资深作家。请根据用户的修改要求，修改以下章节细纲。

=== 章节信息 ===
章节标题：${chapterTitle}
章节序号：第${chapterNumber}章

=== 当前细纲 ===
${currentOutline}

=== 修改要求 ===
${modificationRequest}

=== 上下文信息 ===
卷大纲：
${context.volumeOutline}

角色设定：
${context.characters}

世界观设定：
${context.worldSettings}

=== 输出要求 ===
请根据修改要求，输出修改后的完整章节细纲。
- 保留原细纲中不需要修改的部分
- 按照要求进行调整和优化
- 确保细纲仍然具体且可操作
- 确保与前后章节连贯
- 输出格式使用 Markdown
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyChapterOutline',
      promptTemplateName: 'CHAPTER_OUTLINE_MODIFY_PROMPT',
      inputParameters: {
        chapterTitle,
        chapterNumber,
        modificationRequest,
        currentOutlineLength: currentOutline.length
      }
    }

    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage(`第${chapterNumber}章细纲修改完成`)
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'chapter-outline-modify', loggingConfig)

    return fullContent
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

    const typeMap: Record<ProjectType, string> = {
      'novel': '长篇小说',
      'short-story': '短篇故事',
      'script': '短剧剧本'
    }

    let prompt = `你是一位资深${typeMap[projectType]}作家。请根据以下信息，创作第${chapterNumber}章的正文。

=== 本章信息 ===
章节标题：${chapterTitle}
章节序号：第${chapterNumber}章

=== 章节细纲 ===
${chapterOutline}

=== 所属卷大纲 ===
${volumeOutline}

=== 世界观设定 ===
${worldSettings}

=== 角色设定 ===
${characters}
`

    // 添加前面章节的摘要，保证连贯性
    if (previousChapters && previousChapters.length > 0) {
      prompt += `
=== 前面章节摘要 ===
${previousChapters.map((ch, i) => `--- 第${i + 1}章：${ch.title} ---\n${ch.summary}`).join('\n\n')}

注意：必须与前文保持连贯，承接前文情节发展。
`
    }

    // 用户输入的要求
    if (userInput && userInput.trim()) {
      prompt += `
=== 用户对本章正文的要求 ===
${userInput.trim()}

请根据用户的要求来创作本章正文，同时优化和补充用户提出的想法。
`
    }

    prompt += `
=== 输出要求 ===
请根据章节细纲创作第${chapterNumber}章的正文：

1. **文体要求**：
   - 使用流畅的叙述性语言
   - 对话要自然、符合角色性格
   - 描写要生动、有画面感

2. **内容要求**：
   - 严格按照细纲的结构和重点来创作
   - 确保每个场景都得到充分展开
   - 角色行为要符合其性格和动机
   - 情节推进要自然、有张力

3. **格式要求**：
   - 使用 Markdown 格式
   - 场景之间用分隔线（---）隔开
   - 对话使用引号
   - 段落清晰，易于阅读

重要：
- 直接输出正文内容，不要包含解释或说明
- 确保与前后章节连贯
- 文风要一致
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
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

    const prompt = `你是一位资深作家。请根据用户的修改要求，修改以下章节正文。

=== 当前正文 ===
${currentContent}

${selectedText ? `=== 选中要修改的文本 ===\n${selectedText}\n` : ''}

=== 修改要求 ===
${modificationRequest || '请优化这段正文，使其更流畅、更有感染力'}

=== 输出要求 ===
请根据修改要求，输出修改后的完整正文。

- 保留不需要修改的部分
- 按照要求进行调整和优化
- 确保修改后仍然连贯、自然
- 直接输出修改后的正文，不要包含解释或说明
- 输出格式使用 HTML（与输入格式一致）
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
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
