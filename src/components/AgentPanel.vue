<template>
  <div class="agent-panel h-full flex flex-col bg-[var(--bg-secondary)] border-l" style="border-color: var(--el-border-color); min-width: 260px; width: 260px">
    <!-- 面板头部 -->
    <div class="p-3 border-b" style="border-color: var(--el-border-color)">
      <div class="text-xs font-medium" style="color: var(--el-text-color-placeholder)">AI 助手</div>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <!-- 目标字数设置 -->
      <div class="mb-4">
        <div class="text-xs mb-1" style="color: var(--el-text-color-placeholder)">目标字数</div>
        <el-input-number
          v-model="targetWordCount"
          :min="500"
          :max="10000"
          :step="500"
          size="small"
          class="w-full"
          controls-position="right"
        />
      </div>

      <!-- 常用 Agent -->
      <div class="mb-4">
        <div class="text-xs mb-2" style="color: var(--el-text-color-placeholder)">常用</div>
        <div
          v-for="agent in commonAgents"
          :key="agent.type"
          class="w-full text-left text-xs py-1.5 px-2 rounded cursor-pointer transition-colors mb-1"
          :class="agent.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--el-fill-color-light)]'"
          :style="{ color: agent.disabled ? 'var(--el-text-color-disabled)' : 'var(--el-text-color-regular)' }"
          :disabled="agent.disabled"
          @click="!agent.disabled && runAgent(agent.type, agent.name)"
        >
          {{ agent.name }}
        </div>
      </div>

      <!-- 模型选择 -->
      <div class="mb-4">
        <div class="text-xs mb-1" style="color: var(--el-text-color-placeholder)">当前模型</div>
        <el-select
          :model-value="activeModelId"
          placeholder="请选择模型"
          class="w-full"
          size="small"
          @change="setActiveModel"
        >
          <el-option
            v-for="m in models"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
      </div>

      <!-- 更多 Agent（分组） -->
      <div>
        <div class="text-xs mb-1" style="color: var(--el-text-color-placeholder)">更多</div>
        <el-collapse>
          <el-collapse-item
            v-for="group in agentGroups"
            :key="group.name"
            :title="group.name"
            :name="group.name"
          >
            <div
              v-for="agent in group.agents"
              :key="agent.type"
              class="w-full text-left text-xs py-1 px-2 rounded cursor-pointer hover:bg-[var(--el-fill-color-light)] transition-colors mb-1"
              style="color: var(--el-text-color-regular)"
              @click="runAgent(agent.type, agent.name)"
            >
              {{ agent.name }}
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- 执行状态栏 -->
    <div
      v-if="isExecuting"
      class="p-3 border-t flex items-center gap-2 text-xs"
      style="border-color: var(--el-border-color); color: var(--color-primary)"
    >
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ executingAgentName }} 正在执行...</span>
      <el-button
        class="ml-auto"
        type="danger"
        link
        size="small"
        @click="stopExecution"
      >
        停止
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import type { AgentType } from '@/agents/types'

const props = defineProps<{
  isExecuting?: boolean
  executingAgentName?: string
}>()

const emit = defineEmits<{
  (e: 'run-agent', payload: { type: string; targetWordCount?: number }): void
  (e: 'stop-agent'): void
}>()

const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const targetWordCount = ref(3000)

const models = computed(() => settingsStore.settings.models)
const activeModelId = computed(() => settingsStore.settings.activeModelId)

// 常用 Agent
const commonAgents = [
  { type: 'continue', name: '⏩ 续写', disabled: false },
  { type: 'polish', name: '✨ 润色', disabled: false },
  { type: 'dialogue', name: '💬 对话优化', disabled: false },
  { type: 'chapter', name: '📝 生成本章', disabled: false }
]

// Agent 分组
const agentGroups = [
  {
    name: '前期创作',
    agents: [
      { type: 'idea', name: '💡 创意激发' },
      { type: 'world', name: '🌍 世界观构建' },
      { type: 'character', name: '👤 角色设计' },
      { type: 'outline', name: '📐 大纲规划' }
    ]
  },
  {
    name: '质量保障',
    agents: [
      { type: 'consistency', name: '🔍 一致性检查' },
      { type: 'foreshadow', name: '🎯 伏笔管理' },
      { type: 'anti_ai', name: '🤖 降 AI 味' },
      { type: 'emotion', name: '❤️ 情感曲线' },
      { type: 'pacing', name: '⏱️ 节奏把控' }
    ]
  },
  {
    name: '写作辅助',
    agents: [
      { type: 'scene', name: '🎬 场景扩写' },
      { type: 'name', name: '📛 命名工厂' },
      { type: 'reader', name: '👁️ 读者反馈' }
    ]
  }
]

function runAgent(type: string, _name: string): void {
  emit('run-agent', { type, targetWordCount: targetWordCount.value || undefined })
}

function stopExecution(): void {
  emit('stop-agent')
}

function setActiveModel(id: string): void {
  settingsStore.setActiveModel(id)
}
</script>
