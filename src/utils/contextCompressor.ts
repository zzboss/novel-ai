/**
 * 上下文压缩工具函数
 * 用于在传入 LLM 之前，对上下文信息进行压缩和过滤，只保留与当前章节相关的信息
 */

import type { ChapterOutlineJSON, SceneOutline } from '@/stores/agent/generators/chapter'

/**
 * 根据章节细纲过滤相关的世界观设定
 * @param worldSettings 完整世界观设定（字符串）
 * @param chapterOutline 章节细纲（JSON 字符串或解析后的对象）
 * @returns 压缩后的世界观设定（只保留相关部分）
 */
export function filterRelevantWorldSettings(
  worldSettings: string,
  chapterOutline: string | ChapterOutlineJSON
): string {
  // 解析章节细纲
  const outline: ChapterOutlineJSON = typeof chapterOutline === 'string'
    ? JSON.parse(chapterOutline)
    : chapterOutline

  // 提取关键词
  const keywords = new Set<string>()

  // 提取场景位置
  outline.scenes.forEach((scene: SceneOutline) => {
    keywords.add(scene.location)
  })

  // 提取角色名称（用于匹配势力）
  outline.scenes.forEach((scene: SceneOutline) => {
    scene.characters.forEach((name: string) => keywords.add(name))
  })

  // 将世界观设定按段落分割
  const paragraphs = worldSettings.split('\n\n')

  // 只保留包含关键词的段落
  const relevantParagraphs = paragraphs.filter(p => {
    return Array.from(keywords).some(keyword => p.includes(keyword))
  })

  // 如果过滤后内容过少（<200 字），则返回完整设定的前 1000 字
  const compressed = relevantParagraphs.join('\n\n')
  if (compressed.length < 200 && worldSettings.length > 0) {
    return worldSettings.slice(0, 1000) + '\n...(更多设定省略)'
  }

  return compressed
}

/**
 * 根据章节细纲过滤相关的角色档案
 * @param characters 完整角色档案（字符串）
 * @param chapterOutline 章节细纲（JSON 字符串或解析后的对象）
 * @returns 压缩后的角色档案（只保留本章涉及的角色）
 */
export function filterRelevantCharacters(
  characters: string,
  chapterOutline: string | ChapterOutlineJSON
): string {
  // 解析章节细纲
  const outline: ChapterOutlineJSON = typeof chapterOutline === 'string'
    ? JSON.parse(chapterOutline)
    : outline

  // 提取涉及角色
  const involvedCharacters = new Set<string>()
  outline.scenes.forEach((scene: SceneOutline) => {
    scene.characters.forEach((name: string) => involvedCharacters.add(name))
  })

  // 如果未提取到角色，返回空字符串
  if (involvedCharacters.size === 0) {
    return ''
  }

  // 解析角色档案字符串，只保留相关角色
  // 假设角色档案格式为：
  // 角色名：xxx
  // 身份：xxx
  // ...
  // （空行分隔不同角色）
  const characterBlocks = characters.split('\n\n')
  const relevantBlocks = characterBlocks.filter(block => {
    const lines = block.split('\n')
    const nameLine = lines[0] || '' // 假设第一行是角色名
    return Array.from(involvedCharacters).some(name => nameLine.includes(name))
  })

  // 如果过滤后内容过少，返回前 500 字
  const compressed = relevantBlocks.join('\n\n')
  if (compressed.length < 100 && characters.length > 0) {
    return characters.slice(0, 500) + '\n...(更多角色省略)'
  }

  return compressed
}

/**
 * 压缩前文摘要：保留最近 N 章，每章摘要压缩至 maxLength 字
 * @param chapters 前文章节数组（包含 title 和 summary）
 * @param maxChapters 保留的最大章节数（默认 3）
 * @param maxLengthPerChapter 每章摘要的最大长度（默认 150 字）
 * @returns 压缩后的前文摘要字符串
 */
export function compressPreviousChapters(
  chapters: Array<{ title: string; summary: string }>,
  maxChapters: number = 3,
  maxLengthPerChapter: number = 150
): string {
  // 如果无前文，返回提示
  if (!chapters || chapters.length === 0) {
    return '（无前文，这是开篇章节）'
  }

  // 只保留最近 N 章
  const recent = chapters.slice(-maxChapters)

  // 压缩每章摘要
  return recent.map(ch => {
    let compressed = ch.summary
    if (compressed.length > maxLengthPerChapter) {
      // 简单截断（可改进为智能摘要）
      compressed = compressed.slice(0, maxLengthPerChapter) + '...'
    }
    return `--- ${ch.title} ---\n${compressed}`
  }).join('\n\n')
}

/**
 * 压缩章节细纲：提取关键要点，用于章节正文生成
 * @param chapterOutline 完整章节细纲（JSON 字符串或解析后的对象）
 * @returns 压缩后的细纲要点（字符串）
 */
export function compressChapterOutline(
  chapterOutline: string | ChapterOutlineJSON
): string {
  // 解析章节细纲
  const outline: ChapterOutlineJSON = typeof chapterOutline === 'string'
    ? JSON.parse(chapterOutline)
    : outline

  let compressed = `## 章节核心目标\n${outline.coreGoal}\n\n`

  compressed += `## 场景列表（共 ${outline.scenes.length} 场）\n`
  outline.scenes.forEach((scene: SceneOutline) => {
    compressed += `\n### 场景 ${scene.sceneId}：${scene.location}\n`
    compressed += `- 情感基调：${scene.emotionalTone}\n`
    compressed += `- 出场角色：${scene.characters.join('、')}\n`
    compressed += `- 主要事件：${scene.events.slice(0, 100)}...\n`
  })

  compressed += `\n## 下章钩子\n${outline.nextChapterHook}\n`

  return compressed
}

/**
 * 根据章节位置动态调整上下文压缩策略
 * @param chapterNumber 当前章节序号
 * @param totalChapters 项目总章节数（可选）
 * @returns 压缩策略配置
 */
export function getCompressionStrategy(
  chapterNumber: number,
  totalChapters?: number
): {
  maxChapters: number
  maxSummaryLength: number
  keepFullWorldSettings: boolean
  keepFullCharacters: boolean
} {
  // 根据章节位置调整
  let maxChapters: number
  let maxSummaryLength: number

  if (chapterNumber <= 3) {
    // 开篇章节：需要更多上下文
    maxChapters = 1
    maxSummaryLength = 300
  } else if (chapterNumber <= 10) {
    // 早期章节
    maxChapters = 3
    maxSummaryLength = 200
  } else {
    // 中期及以后章节
    maxChapters = 3
    maxSummaryLength = 150
  }

  // 根据项目规模调整
  if (totalChapters) {
    if (totalChapters <= 10) {
      // 短篇项目：可以传入更多上下文
      maxChapters = Math.min(maxChapters + 2, totalChapters)
      maxSummaryLength = 300
    } else if (totalChapters <= 50) {
      // 中篇项目：标准压缩
      // 使用默认值
    } else {
      // 长篇项目：更激进的压缩
      maxChapters = Math.min(maxChapters, 2)
      maxSummaryLength = 100
    }
  }

  return {
    maxChapters,
    maxSummaryLength,
    keepFullWorldSettings: chapterNumber <= 3, // 开篇章节保留完整世界观
    keepFullCharacters: chapterNumber <= 5 // 早期章节保留完整角色档案
  }
}
