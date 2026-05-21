import { defineStore } from 'pinia'

// 导入状态管理（必须先导入到当前作用域，才能在 setup 中使用）
import {
  tasks,
  runningCount,
  currentStreaming,
  currentStep,
  progressMessage,
  error,
  isAiProcessing,
  aiProcessingMessage,
  pipelineRunning,
  pipelineCurrentStep,
  pipelineProgress,
  updateTasks,
  incrementRunning,
  decrementRunning,
  setCurrentStreaming,
  appendToStreaming,
  clearStreaming,
  setCurrentStep,
  setProgressMessage,
  setError,
  setAiProcessing,
  clearAll,
  hasRunningTasks,
  hasError
} from './state'

// 重新导出状态管理
export {
  tasks,
  runningCount,
  currentStreaming,
  currentStep,
  progressMessage,
  error,
  isAiProcessing,
  aiProcessingMessage,
  pipelineRunning,
  pipelineCurrentStep,
  pipelineProgress,
  updateTasks,
  incrementRunning,
  decrementRunning,
  setCurrentStreaming,
  appendToStreaming,
  clearStreaming,
  setCurrentStep,
  setProgressMessage,
  setError,
  setAiProcessing,
  clearAll,
  hasRunningTasks,
  hasError
}

// 导入生成器函数（先导入到当前作用域，再重新导出）
import { generateIdea, modifyIdea } from './generators/idea'
import { generateWorld, modifyWorld } from './generators/world'
import { generateCharacters } from './generators/character'
import { generateOutline1, generateOutline1Volume } from './generators/outline'
import { generateQuestionSuggestions } from './generators/suggestions'
import { generateCharacterByDescription, generateFieldSuggestions } from './generators/characterHelpers'
import { generateVolumeByDescription } from './generators/volumeHelpers'
import { generateContent } from './generators'

// 导入管线函数
import { executeChapterPipeline, triggerPostSaveUpdate } from './pipeline'

// 导入标题生成函数
import { generateChapterTitle, generateTitleFromContent, generateVolumeTitle } from './titleGenerator'

// 重新导出生成器、管线、标题函数
export {
  generateIdea,
  modifyIdea,
  generateWorld,
  modifyWorld,
  generateCharacters,
  generateOutline1,
  generateOutline1Volume,
  generateContent,
  generateQuestionSuggestions,
  generateCharacterByDescription,
  generateFieldSuggestions,
  generateVolumeByDescription,
  executeChapterPipeline,
  triggerPostSaveUpdate,
  generateChapterTitle,
  generateTitleFromContent,
  generateVolumeTitle
}

/**
 * ============================================================
 * Agent 状态管理 Store
 * 管理 Agent 任务队列状态和流式输出内容
 * ============================================================
 */
export const useAgentStore = defineStore('agent', () => {
  // 返回所有状态和方法的组合
  return {
    // 状态（从 state.ts 导入）
    tasks,
    runningCount,
    currentStreaming,
    currentStep,
    progressMessage,
    error,
    isAiProcessing,
    aiProcessingMessage,
    hasRunningTasks,
    hasError,
    pipelineRunning,
    pipelineCurrentStep,
    pipelineProgress,

    // 状态操作方法（从 state.ts 导入）
    updateTasks,
    incrementRunning,
    decrementRunning,
    setCurrentStreaming,
    appendToStreaming,
    clearStreaming,
    setCurrentStep,
    setProgressMessage,
    setError,
    setAiProcessing,
    clearAll,

    // 生成方法（从 generators 导入）
    generateIdea,
    modifyIdea,
    generateWorld,
    modifyWorld,
    generateCharacters,
    generateOutline1,
    generateOutline1Volume,
    generateContent,
    generateQuestionSuggestions,
    generateCharacterByDescription,
    generateFieldSuggestions,
    generateVolumeByDescription,

    // 管线方法（从 pipeline.ts 导入）
    executeChapterPipeline,
    triggerPostSaveUpdate,

    // 标题生成方法（从 titleGenerator.ts 导入）
    generateChapterTitle,
    generateVolumeTitle,
    generateTitleFromContent
  }
})
