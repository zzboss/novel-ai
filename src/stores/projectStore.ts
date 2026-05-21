import { defineStore } from 'pinia'

// 从各模块导入所有内容
import {
  project,
  currentChapterId,
  isDirty,
  selectedVolumeId,
  currentVolume,
  currentChapter,
  lastAutoSaveTime,
  isAutoSaving,
  session,
  isAiProcessing,
  aiProgressMessage,
  triggerAutoSave,
  stopAutoSave,
  saveProject,
  markDirty,
  markSaved
} from './project/state'

import {
  createProject,
  openProject,
  deleteProject,
  loadProject
} from './project/operations'

import {
  setCurrentChapter,
  setSelectedVolume,
  addChapter,
  removeChapter,
  updateChapterTitle,
  updateChapterWordCount,
  addVolume,
  updateVolumeTitle,
  updateVolumeContent
} from './project/chapterManager'

import {
  updateStoryState,
  saveStateSnapshot,
  rollbackStoryState,
  deleteSnapshotsAfter
} from './project/storyState'

import {
  saveSession,
  loadSession,
  clearSavedSession
} from './project/session/sessionManager'

import {
  startSession,
  startEditSession
} from './project/session/sessionLifecycle'

import {
  getCurrentStep,
  getCurrentStepState,
  updateStepState,
  goToStep,
  goToNextStep,
  goToPrevStep
} from './project/session/stepManager'

import {
  completeCurrentStep,
  skipCurrentStep,
  setProjectType,
  updateProjectName,
  updateIdea,
  setAiProcessing,
  clearSession,
  saveProjectToFile,
  generateProjectState
} from './project/session/sessionOperations'

/**
 * ============================================================
 * 项目状态管理 Store
 * 管理当前项目状态、当前章节、创建向导状态等
 * ============================================================
 */
export const useProjectStore = defineStore('project', () => {
  // 返回所有状态和方法的组合
  return {
    // 项目状态
    project,
    currentChapterId,
    isDirty,
    selectedVolumeId,
    currentVolume,
    currentChapter,
    lastAutoSaveTime,
    isAutoSaving,

    // 向导状态
    session,
    isAiProcessing,
    aiProgressMessage,

    // 项目操作方法
    loadProject,
    setCurrentChapter,
    setSelectedVolume,
    markDirty,
    markSaved,
    createProject,
    openProject,
    saveProject,
    addChapter,
    removeChapter,
    updateChapterTitle,
    updateChapterWordCount,
    addVolume,
    updateVolumeTitle,
    updateVolumeContent,
    deleteProject,
    triggerAutoSave,
    stopAutoSave,
    updateStoryState,
    saveStateSnapshot,
    rollbackStoryState,
    deleteSnapshotsAfter,

    // 向导操作方法
    saveSession,
    loadSession,
    clearSavedSession,
    startSession,
    startEditSession,
    getCurrentStep,
    getCurrentStepState,
    updateStepState,
    goToStep,
    goToNextStep,
    goToPrevStep,
    completeCurrentStep,
    skipCurrentStep,
    setProjectType,
    updateProjectName,
    updateIdea,
    setAiProcessing,
    clearSession,
    generateProjectState,
    saveProjectToFile
  }
})
