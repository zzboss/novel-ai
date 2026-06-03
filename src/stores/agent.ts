/**
 * Agent Store - 重新导出
 * 
 * 此文件重新导出 agent 模块的所有内容，确保向后兼容性。
 * 实际的实现已拆分到 ./agent/ 目录下的多个文件中。
 * 
 * @see ./agent/index.ts - 主入口文件
 * @see ./agent/prompts.ts - 提示词模板
 * @see ./agent/state.ts - 状态管理
 * @see ./agent/generators/ - 各种生成器函数
 * @see ./agent/pipeline.ts - 管线执行
 * @see ./agent/titleGenerator.ts - 标题生成
 */

// 重新导出 agent store
export { useAgentStore } from './agent/index'

export {
  // 状态
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
  // 状态操作方法
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
  // 生成方法
  generateIdea,
  generateWorld,
  generateCharacters,
  generateOutline1,
  generateOutline1Volume,
  generateContent,
  generateQuestionSuggestions,
  generateCharacterByDescription,
  generateFieldSuggestions,
  generateVolumeByDescription,
  generateMap,
  // 管线方法
  executeChapterPipeline,
  triggerPostSaveUpdate,
  // 标题生成方法
  generateChapterTitle,
  generateVolumeTitle,
  generateTitleFromContent
} from './agent/index'
