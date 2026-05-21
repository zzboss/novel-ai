import type { CreationStep, ProjectType } from '../project'
import { generateIdea } from './idea'
import { generateWorld } from './world'
import { generateCharacters } from './character'
import { generateOutline1 } from './outline'

/**
 * 通用内容生成方法（根据步骤调用对应的生成函数）
 * @param step - 当前步骤
 * @param params - 生成参数
 * @returns 生成的内容
 */
export async function generateContent(
  step: CreationStep,
  params: {
    userInput?: string
    idea?: string
    worldSettings?: string
    characters?: string
    outline1?: string
    projectType: ProjectType
  }
): Promise<string> {
  switch (step) {
    case 'idea':
      if (!params.userInput) throw new Error('生成灵感需要用户输入')
      return generateIdea(params.userInput, params.projectType)
    
    case 'world':
      if (!params.idea) throw new Error('生成世界观需要灵感描述')
      return generateWorld(params.idea, params.projectType)
    
    case 'character':
      if (!params.idea || !params.worldSettings) throw new Error('生成角色需要灵感描述和世界观设定')
      return generateCharacters(params.idea, params.worldSettings, params.projectType)
    
    case 'outline-1':
      if (!params.idea || !params.worldSettings || !params.characters) throw new Error('生成大纲需要灵感、世界观和角色设定')
      return generateOutline1(params.idea, params.worldSettings, params.characters, params.projectType)
    
    default:
      throw new Error(`不支持的步骤: ${step}`)
  }
}
