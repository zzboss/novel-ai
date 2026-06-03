import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage, ModelConfig } from '@/llm/types'
import type { ProjectType } from '@/stores/project'

/**
 * AI 生成候选章节标题
 * 根据已有章节、前一章节概述和项目大纲，生成 3-5 个候选章节标题
 * @param previousChapterOutline - 前一章节的概述（outline），用于承上启下
 * @returns AI 生成的候选标题原始文本
 */
export async function generateChapterTitle(previousChapterOutline?: string): Promise<string> {
  const projectStore = useProjectStore()
  const project = projectStore.project
  if (!project) throw new Error('未打开项目')

  const settingsStore = useSettingsStore()
  const modelConfig = settingsStore.activeModel
  if (!modelConfig) throw new Error('未配置默认模型，请在设置中配置AI模型')

  // 构建上下文：已有章节标题 + 项目信息
  const allChapters = project.volumes.flatMap(v => v.chapters)
  const recentTitles = allChapters.slice(-5).map((ch, i) =>
    `${allChapters.length - 4 + i}. ${ch.title}`
  ).join('\n')

  const volumeTitles = project.volumes.map((v, i) =>
    `${i + 1}. ${v.title}`
  ).join('\n')

  const unitName = project.projectType === 'script' ? '集'
    : project.projectType === 'short-story' ? '部分' : '章'

  const prompt = `你是一位资深小说编辑，需要为正在创作的作品生成章节标题。

=== 作品信息 ===
作品名称：${project.name}
类型：${project.projectType === 'novel' ? '长篇小说' : project.projectType === 'short-story' ? '短篇故事' : '短剧剧本'}

=== 卷结构 ===
${volumeTitles || '暂无卷信息'}

=== 最近章节标题 ===
${recentTitles || '这是第一章，暂无已有章节'}

${previousChapterOutline ? `=== 前一章节概述 ===\n${previousChapterOutline}\n\n→ 请基于前一章的内容，生成能承上启下的本章标题，确保情节连贯。` : '→ 这是开篇章节，请生成一个有力的开篇标题。'}

=== 要求 ===
请根据作品的整体风格和情节脉络${previousChapterOutline ? '，以及前一章的概述' : ''}，生成 3-5 个适合接下来创作的${unitName}节标题。要求：
1. 标题简洁有力，严格 4-15 个字
2. 与前文风格保持一致
3. 能暗示本章主要内容或情节走向${previousChapterOutline ? '，并与前一章概述形成承上启下关系' : ''}
4. 每行一个标题，不要编号、不要引号、不要任何说明文字
5. 直接输出标题文本，不要有任何前缀或后缀

⚠️ 只能输出标题，每行一个，不要输出其他任何内容！`

  const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

  const loggingConfig: LLMLoggingConfig = {
    operationType: 'generateChapterTitle',
    promptTemplateName: 'CHAPTER_TITLE_PROMPT',
    inputParameters: { 
      projectName: project.name,
      projectType: project.projectType,
      existingVolumesCount: project.volumes.length,
      recentChaptersCount: allChapters.slice(-5).length,
      hasPreviousOutline: !!previousChapterOutline
    }
  }

  // 使用非流式调用，章节标题生成数据量小
  const result = await LLMClient.chat(modelConfig, messages, 'title-generator', loggingConfig)
  return result
}

/**
 * 根据章节内容生成标题
 * @param content - 章节正文内容
 * @returns 生成的标题（纯文本）
 */
export async function generateTitleFromContent(content: string): Promise<string> {
  const settingsStore = useSettingsStore()
  const modelConfig = settingsStore.activeModel
  if (!modelConfig) throw new Error('未配置默认模型')

  // 截取内容前2000字作为上下文
  const truncatedContent = content.slice(0, 2000)

  const prompt = `你是一位资深小说编辑，请根据以下章节内容，生成一个简洁有力的章节标题。

=== 章节内容（节选）===
${truncatedContent}

=== 要求 ===
1. 标题简洁有力，通常 2-8 个字
2. 能概括本章核心内容或暗示情节走向
3. 风格与小说整体风格一致
4. 直接输出标题文本，不要有编号、引号或其他说明文字
5. 只输出一个最佳标题

示例输出：
风起云涌`

  const messages: LLMMessage[] = [{ role: 'user', content: prompt }]

  const loggingConfig: LLMLoggingConfig = {
    operationType: 'generateTitleFromContent',
    promptTemplateName: 'TITLE_FROM_CONTENT_PROMPT',
    inputParameters: { contentLength: content.length }
  }

  const result = await LLMClient.chat(modelConfig, messages, 'title-from-content', loggingConfig)
  
  // 清理返回结果，去掉可能的引号和说明文字
  return result.replace(/^["'"'']|["'"'']$/g, '').replace(/^标题[：:]\s*/, '').trim()
}

/**
 * AI 生成卷标题（多个候选）
 * 根据创作上下文（灵感、世界观、角色）和大纲内容，生成 3-5 个候选卷标题
 * @param idea - 创作灵感
 * @param worldSettings - 世界观设定
 * @param characters - 角色设定
 * @param projectType - 项目类型
 * @param volumeIndex - 卷序号（从1开始）
 * @param volumeContent - 该卷大纲内容（可选）
 * @param existingTitles - 已有卷标题列表（可选，用于连贯性）
 * @param loggingConfig - 可选，日志记录配置（含 operationType/projectPath 等）
 * @param selectedModelConfig - 可选，指定使用的模型配置（如不指定则使用默认模型）
 * @returns AI 生成的候选卷标题数组（4-15字 each）
 */
export async function generateVolumeTitle(
  idea: string,
  worldSettings: string,
  characters: string,
  projectType: ProjectType,
  volumeIndex: number,
  volumeContent?: string,
  existingTitles?: string[],
  loggingConfig?: { operationType?: string; projectPath?: string; promptTemplateName?: string; inputParameters?: Record<string, unknown> },
  selectedModelConfig?: ModelConfig
): Promise<string[]> {
  const settingsStore = useSettingsStore()
  const modelConfig = selectedModelConfig || settingsStore.activeModel
  if (!modelConfig) throw new Error('未配置默认模型，请在设置中配置AI模型')

  const typeMap: Record<string, string> = {
    'novel': '长篇小说',
    'short-story': '短篇故事',
    'script': '短剧剧本'
  }
  const unitMap: Record<string, string> = {
    'novel': '卷',
    'short-story': '部分',
    'script': '集'
  }
  const unit = unitMap[projectType]

  let prompt = `你是一位资深${typeMap[projectType]}编辑，擅长根据作品内容提炼出精准有力的标题。

## 任务
为${typeMap[projectType]}的「第${volumeIndex}${unit}」生成 3-5 个候选标题。

## 可用上下文（必须基于以下内容生成，不要凭空想象）

### 创作灵感
${idea || '（无）'}
${idea ? '→ 请从上述灵感中提取核心主题和情感基调，融入标题设计。' : ''}

### 世界观设定
${worldSettings || '（无）'}
${worldSettings ? '→ 标题应符合此世界观的基调（如：严肃/轻松、古代/现代、现实/奇幻）。' : ''}

### 主要角色
${characters || '（无）'}
${characters ? '→ 如果本卷围绕特定角色展开，可在标题中体现其特质或命运。' : ''}
`

  if (volumeContent && volumeContent.trim()) {
    prompt += `
### 第${volumeIndex}${unit}大纲内容（重点！）
${volumeContent.trim().substring(0, 2000)}

→ **必须基于上述大纲内容**生成标题！请先分析大纲的核心冲突、关键转折或主题思想，再提炼标题。标题应反映本卷的核心内容或高潮。
`
  }

  if (existingTitles && existingTitles.length > 0) {
    const prevTitles = existingTitles.slice(0, volumeIndex - 1).map((t, i) => `  第${i + 1}${unit}：「${t}」`).join('\n')
    const nextTitles = existingTitles.slice(volumeIndex).map((t, i) => `  第${volumeIndex + i + 1}${unit}：「${t}」`).join('\n')
    
    prompt += `
### 已有${unit}标题（用于保持连贯性）
${prevTitles ? `  前文${unit}标题：\n${prevTitles}` : ''}${prevTitles && nextTitles ? '\n' : ''}${nextTitles ? `  后文${unit}标题：\n${nextTitles}` : ''}

→ 新标题应与已有标题风格统一（如：都是2字、4字，或都引用诗词），但内容不重复。
`
  }

  prompt += `
## 生成要求
1. **字数**：严格 4-15 字，绝对不超过15字
2. **相关性**：必须基于上述上下文，尤其是大纲内容（如有）
3. **概括性**：能高度概括本${unit}核心内容或主题
4. **风格统一**：与已有标题（如有）风格一致
5. **多样性**：3-5 个候选标题应角度不同（如：有的侧重情节，有的侧重情感，有的侧重主题）
6. **输出格式**：每行一个标题，不要编号、不要引号、不要任何解释

## 禁止
- 不要输出序号（如 "1."、"一、"）
- 不要输出说明文字（如 "以下是候选标题："）
- 不要输出示例或解释
- 不要使用标点符号（除非是书名号等标题固有标点）

请直接输出 3-5 行标题，每行一个。`


  const messages: LLMMessage[] = [{ role: 'user', content: prompt }]
  const startTime = Date.now()

  let result: string = ''
  try {
    result = await LLMClient.chat(modelConfig, messages, loggingConfig?.promptTemplateName || 'volume-title-generate', loggingConfig)
  } catch (err) {
    throw err
  }

  // 解析结果：每行一个标题，过滤空行和序号前缀
  const candidates = result
    .split('\n')
    .map(line => line
      .replace(/^[""「『]|[""」』]$/g, '') // 去除引号
      .replace(/^\d+[\.、)）]\s*/, '') // 去除序号前缀（如 "1. "、"2、"、"3) "）
      .replace(/^第\d+[卷部分集]\s*[：:]*\s*/, '') // 去除"第X卷"前缀
      .trim()
    )
    .filter(line => line.length >= 4 && line.length <= 15) // 4-15字

  return candidates.length > 0 ? candidates : [result.replace(/^[""「『]|[""」』]$/g, '').trim().slice(0, 15)]
}
