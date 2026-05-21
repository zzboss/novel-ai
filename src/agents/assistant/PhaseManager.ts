/**
 * PhaseManager - 对话阶段管理器
 * 
 * 负责管理对话阶段的转换逻辑
 * 阶段：greeting -> understanding -> planning -> generating -> reviewing
 */

import type { ConversationPhase } from '../WritingAssistantAgent'

export class PhaseManager {
  private currentPhase: ConversationPhase = 'greeting'

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): ConversationPhase {
    return this.currentPhase
  }

  /**
   * 设置阶段
   */
  setPhase(phase: ConversationPhase): void {
    this.currentPhase = phase
  }

  /**
   * 根据意图和当前阶段，计算下一阶段
   */
  calculateNextPhase(intentType: string): ConversationPhase {
    if (this.currentPhase === 'greeting') {
      if (intentType !== 'unknown') {
        return 'understanding'
      }
    }

    if (this.currentPhase === 'understanding') {
      if (intentType === 'generate' || intentType === 'continue') {
        return 'planning'
      }
      return 'understanding'
    }

    if (this.currentPhase === 'planning') {
      return 'generating'
    }

    if (this.currentPhase === 'generating') {
      return 'reviewing'
    }

    return this.currentPhase
  }

  /**
   * 更新阶段（优先使用建议的阶段）
   */
  updatePhase(suggestedPhase?: ConversationPhase): void {
    if (suggestedPhase) {
      this.currentPhase = suggestedPhase
    }
  }

  /**
   * 重置到初始阶段
   */
  reset(): void {
    this.currentPhase = 'greeting'
  }
}
